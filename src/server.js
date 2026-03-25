import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import axios from 'axios';
import { parseEnvironmentConfig } from './config.js';
import { buildInputSchema } from './schema-builder.js';
import { compactSchema } from './schema-compactor.js';
import { groupEndpoints, buildGroupedTool } from './tool-grouper.js';
import { ApiRegistry } from './api-registry.js';
import { ApiClient } from './api-client.js';

const BLOCKED_HEADERS = ['host', 'authorization', 'cookie', 'x-forwarded-for'];

export class APIGatewayMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-api-gateway',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registry = new ApiRegistry();
    this.client = new ApiClient(this.registry);
    this._toolCache = null;
    this.setupHandlers();
  }

  buildToolList() {
    const tools = [];

    tools.push({
      name: 'get_api_info',
      description: 'Get information about available APIs and their endpoints',
      inputSchema: {
        type: 'object',
        properties: {
          api_name: {
            type: 'string',
            description: 'Name of the API (optional, shows all if not provided)'
          }
        }
      }
    });

    const supportedMethods = this.registry.getSupportedMethods();

    for (const [apiName, apiData] of this.registry.getAllAPIs()) {
      if (apiData.toolMode === 'grouped') {
        this.buildGroupedTools(tools, apiName, apiData, supportedMethods);
      } else {
        this.buildIndividualTools(tools, apiName, apiData, supportedMethods);
      }
    }

    tools.push({
      name: 'check_api_health',
      description: 'Check connectivity and health of configured APIs',
      inputSchema: {
        type: 'object',
        properties: {
          api_name: {
            type: 'string',
            description: 'Name of the API to check (optional, checks all if not provided)'
          }
        }
      }
    });

    tools.push({
      name: 'execute_api',
      description: 'Execute any API endpoint with custom parameters',
      inputSchema: {
        type: 'object',
        properties: {
          api_name: { type: 'string', description: 'Name of the API' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
          path: { type: 'string', description: 'API endpoint path' },
          params: { type: 'object', description: 'Query parameters' },
          data: { type: 'object', description: 'Request body data' },
          headers: { type: 'object', description: 'Additional headers' }
        },
        required: ['api_name', 'method', 'path']
      }
    });

    return tools;
  }

  buildIndividualTools(tools, apiName, apiData, supportedMethods) {
    for (const [path, pathData] of Object.entries(apiData.paths)) {
      if (!matchesPathFilter(path, apiData.pathPrefixes)) continue;

      for (const [method, operation] of Object.entries(pathData)) {
        if (!supportedMethods.includes(method)) continue;
        if (!matchesTagFilter(operation, apiData.tags)) continue;

        const toolName = this.registry.generateToolName(apiName, method, path, operation.operationId);
        let inputSchema = buildInputSchema(operation, method, apiData.excludeParams);

        if (apiData.schemaMode === 'compact') {
          inputSchema = compactSchema(inputSchema);
        }

        tools.push({
          name: toolName,
          description: operation.summary || `${method.toUpperCase()} ${path}`,
          inputSchema,
        });
      }
    }
  }

  buildGroupedTools(tools, apiName, apiData, supportedMethods) {
    const filteredPaths = {};

    for (const [path, pathData] of Object.entries(apiData.paths)) {
      if (!matchesPathFilter(path, apiData.pathPrefixes)) continue;

      const filteredMethods = {};
      for (const [method, operation] of Object.entries(pathData)) {
        if (!supportedMethods.includes(method)) continue;
        if (!matchesTagFilter(operation, apiData.tags)) continue;
        filteredMethods[method] = operation;
      }

      if (Object.keys(filteredMethods).length > 0) {
        filteredPaths[path] = filteredMethods;
      }
    }

    const filteredApiData = { ...apiData, paths: filteredPaths };
    const groups = groupEndpoints(apiName, filteredApiData, supportedMethods);

    for (const [groupName, operations] of groups) {
      const tool = buildGroupedTool(apiName, groupName, operations, this.registry.groupRouteMap);
      tools.push(tool);
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: this._toolCache };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      try {
        if (name === 'get_api_info') {
          return await this.getAPIInfo(args);
        } else if (name === 'check_api_health') {
          return await this.checkAPIHealth(args);
        } else if (name === 'execute_api') {
          return await this.client.executeAPI(sanitizeExecuteArgs(args));
        } else if (this.registry.getGroupRoute(name)) {
          return await this.client.executeGroupedTool(name, args);
        } else {
          return await this.client.executeDynamicTool(name, args);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ]
        };
      }
    });
  }

  async getAPIInfo(args = {}) {
    const { api_name } = args;
    let info = '';

    if (api_name) {
      const api = this.registry.getAPI(api_name);
      if (!api) {
        return {
          content: [{
            type: 'text',
            text: `API '${api_name}' not found`
          }]
        };
      }

      info = formatAPIInfo(api_name, api, this.registry.getSupportedMethods());
    } else {
      for (const [name, api] of this.registry.getAllAPIs()) {
        info += formatAPIInfo(name, api, this.registry.getSupportedMethods()) + '\n\n---\n\n';
      }
    }

    return {
      content: [{
        type: 'text',
        text: info
      }]
    };
  }

  async checkAPIHealth(args = {}) {
    const { api_name } = args;
    const results = [];

    const apisToCheck = api_name
      ? [[api_name, this.registry.getAPI(api_name)]]
      : [...this.registry.getAllAPIs()];

    for (const [name, api] of apisToCheck) {
      if (!api) {
        results.push({ name, status: 'not_found' });
        continue;
      }

      const start = Date.now();
      try {
        const response = await axios.head(api.baseUrl, {
          timeout: 5000,
          headers: { ...api.headers },
          validateStatus: () => true,
        });
        results.push({
          name,
          baseUrl: api.baseUrl,
          reachable: true,
          statusCode: response.status,
          responseTimeMs: Date.now() - start,
        });
      } catch (error) {
        results.push({
          name,
          baseUrl: api.baseUrl,
          reachable: false,
          error: error.message,
          responseTimeMs: Date.now() - start,
        });
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results, null, 2)
      }]
    };
  }

  async run() {
    const apiConfigs = parseEnvironmentConfig();
    await this.registry.loadAPIs(apiConfigs);
    this._toolCache = this.buildToolList();

    console.error(`Tool list: ${this._toolCache.length} tools, ${(JSON.stringify(this._toolCache).length / 1024).toFixed(1)} KB`);

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP API Gateway Server running...');
  }
}

function matchesPathFilter(path, pathPrefixes) {
  if (pathPrefixes.length === 0) return true;
  return pathPrefixes.some(prefix => path.startsWith(prefix));
}

function matchesTagFilter(operation, tags) {
  if (tags.length === 0) return true;
  if (!operation.tags || operation.tags.length === 0) return false;
  return operation.tags.some(tag => tags.includes(tag));
}

function sanitizeExecuteArgs(args) {
  if (!args.headers) return args;

  const safeHeaders = Object.fromEntries(
    Object.entries(args.headers).filter(
      ([k]) => !BLOCKED_HEADERS.includes(k.toLowerCase())
    )
  );

  return { ...args, headers: safeHeaders };
}

function formatAPIInfo(name, api, supportedMethods) {
  let info = `# API: ${name}\n`;
  info += `Base URL: ${api.baseUrl}\n`;
  info += `Version: ${api.spec.info?.version || 'N/A'}\n\n`;

  info += '## Endpoints:\n';
  for (const [path, pathData] of Object.entries(api.paths)) {
    for (const [method, operation] of Object.entries(pathData)) {
      if (supportedMethods.includes(method)) {
        info += `\n### ${method.toUpperCase()} ${path}\n`;
        info += `${operation.summary || 'No description'}\n`;

        if (operation.parameters?.length > 0) {
          info += 'Parameters:\n';
          for (const param of operation.parameters) {
            info += `- ${param.name} (${param.in}): ${param.description || 'No description'}\n`;
          }
        }
      }
    }
  }

  return info;
}

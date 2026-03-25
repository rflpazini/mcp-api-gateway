import SwaggerParser from '@apidevtools/swagger-parser';

const SUPPORTED_METHODS = ['get', 'post', 'put', 'delete', 'patch'];

export class ApiRegistry {
  constructor() {
    this.apis = new Map();
    this.toolRouteMap = new Map();
    this.groupRouteMap = new Map();
  }

  async loadAPIs(apiConfigs) {
    if (apiConfigs.length === 0) {
      console.error('No APIs configured. Please check environment variables.');
      return;
    }

    let failed = 0;
    for (const apiConfig of apiConfigs) {
      const ok = await this.registerAPI(apiConfig);
      if (!ok) failed++;
    }

    console.error(`Loaded ${this.apis.size} API(s) successfully`);
    if (failed > 0) {
      console.error(`WARNING: ${failed} API(s) failed to load.`);
    }
  }

  async registerAPI(config) {
    try {
      const {
        name, swaggerUrl, swaggerFile, baseUrl, headers = {},
        timeout, maxRetries,
        pathPrefixes, tags, excludeParams, schemaMode, toolMode,
      } = config;

      let api;
      try {
        api = await SwaggerParser.dereference(swaggerUrl || swaggerFile);
      } catch (derefError) {
        console.error(`Dereference failed for '${name}', falling back to bundle:`, derefError.message);
        api = await SwaggerParser.bundle(swaggerUrl || swaggerFile);
      }

      this.apis.set(name, {
        spec: api,
        baseUrl: baseUrl || api.servers?.[0]?.url || '',
        headers,
        paths: api.paths,
        timeout,
        maxRetries,
        pathPrefixes: pathPrefixes || [],
        tags: tags || [],
        excludeParams: new Set(excludeParams || []),
        schemaMode: schemaMode || 'full',
        toolMode: toolMode || 'individual',
      });

      console.error(`API '${name}' registered successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to register API '${config.name}':`, error);
      return false;
    }
  }

  generateToolName(apiName, method, path, operationId) {
    let toolName;

    if (operationId) {
      const sanitized = operationId.replace(/[^a-zA-Z0-9_]/g, '_');
      toolName = `${apiName}_${sanitized}`;
    } else {
      toolName = `${apiName}_${method}_${path.replace(/[{}\/]/g, '_')}`;
    }

    if (this.toolRouteMap.has(toolName)) {
      const methodDisambiguated = `${apiName}_${method}_${operationId ? operationId.replace(/[^a-zA-Z0-9_]/g, '_') : path.replace(/[{}\/]/g, '_')}`;

      if (!this.toolRouteMap.has(methodDisambiguated)) {
        toolName = methodDisambiguated;
      } else {
        let suffix = 2;
        while (this.toolRouteMap.has(`${toolName}_${suffix}`)) {
          suffix++;
        }
        toolName = `${toolName}_${suffix}`;
      }
    }

    this.toolRouteMap.set(toolName, { apiName, method, path });
    return toolName;
  }

  getRoute(toolName) {
    return this.toolRouteMap.get(toolName);
  }

  getGroupRoute(toolName) {
    return this.groupRouteMap.get(toolName);
  }

  getAPI(name) {
    return this.apis.get(name);
  }

  getAllAPIs() {
    return this.apis;
  }

  getSupportedMethods() {
    return SUPPORTED_METHODS;
  }
}

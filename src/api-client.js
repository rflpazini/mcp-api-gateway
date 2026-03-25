import axios from 'axios';
import { getMaxResponseSize } from './config.js';

const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;

export class ApiClient {
  constructor(registry) {
    this.registry = registry;
    this.maxResponseSize = getMaxResponseSize();
  }

  async executeAPI(args) {
    const { api_name, method, path, params, data, headers } = args;

    const api = this.registry.getAPI(api_name);
    if (!api) {
      throw new Error(`API '${api_name}' not found`);
    }

    const url = `${api.baseUrl}${path}`;
    const config = {
      method: method.toLowerCase(),
      url,
      headers: { ...api.headers, ...headers },
      params,
      data,
      timeout: api.timeout || 30000,
      maxContentLength: this.maxResponseSize * 2,
    };

    const maxRetries = api.maxRetries ?? 3;

    const response = await withRetry(
      () => axios(config),
      maxRetries
    );

    const text = JSON.stringify(response.data, null, 2);

    if (text.length > this.maxResponseSize) {
      const truncated = text.slice(0, this.maxResponseSize);
      return {
        content: [{
          type: 'text',
          text: `${truncated}\n\n... [Response truncated. Original size: ${text.length} bytes. Use more specific query parameters to reduce response size.]`
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text
      }]
    };
  }

  async executeDynamicTool(toolName, args) {
    const route = this.registry.getRoute(toolName);
    if (!route) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const { apiName, method, path: routePath } = route;

    let resolvedPath = routePath;
    for (const [key, value] of Object.entries(args)) {
      resolvedPath = resolvedPath.replaceAll(`{${key}}`, encodeURIComponent(String(value)));
    }

    const apiArgs = {
      api_name: apiName,
      method: method.toUpperCase(),
      path: resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`,
      params: {},
      data: args.body
    };

    for (const [key, value] of Object.entries(args)) {
      if (key !== 'body' && !routePath.includes(`{${key}}`)) {
        apiArgs.params[key] = value;
      }
    }

    return await this.executeAPI(apiArgs);
  }

  async executeGroupedTool(toolName, args) {
    const operationMap = this.registry.getGroupRoute(toolName);
    if (!operationMap) {
      throw new Error(`Unknown grouped tool: ${toolName}`);
    }

    const { operation, path_params = {}, params, body, headers } = args;

    if (!operation) {
      throw new Error(`Missing required 'operation' argument. Available: ${[...operationMap.keys()].join(', ')}`);
    }

    const route = operationMap.get(operation);
    if (!route) {
      throw new Error(`Unknown operation '${operation}'. Available: ${[...operationMap.keys()].join(', ')}`);
    }

    let resolvedPath = route.path;
    for (const [key, value] of Object.entries(path_params)) {
      resolvedPath = resolvedPath.replaceAll(`{${key}}`, encodeURIComponent(String(value)));
    }

    const apiName = toolName.split('_')[0];
    // Find the actual API name from any operation in the map
    const api = this.registry.getAPI(apiName);
    const actualApiName = api ? apiName : [...this.registry.getAllAPIs().keys()].find(name => toolName.startsWith(name + '_'));

    return await this.executeAPI({
      api_name: actualApiName || apiName,
      method: route.method.toUpperCase(),
      path: resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`,
      params: params || {},
      data: body,
      headers,
    });
  }
}

async function withRetry(fn, maxRetries) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const status = error.response?.status;
      const isRetryable = status && RETRYABLE_STATUS_CODES.includes(status);

      if (!isRetryable || attempt === maxRetries) {
        throw new Error(`API call failed: ${error.response?.data?.message || error.message}`);
      }

      const retryAfter = error.response?.headers?.['retry-after'];
      let delay;

      if (retryAfter) {
        delay = parseRetryAfter(retryAfter);
      } else {
        delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
      }

      console.error(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms (status: ${status})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function parseRetryAfter(value) {
  const seconds = parseInt(value, 10);
  if (!isNaN(seconds)) {
    return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
  }
  const date = Date.parse(value);
  if (!isNaN(date)) {
    return Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_DELAY_MS);
  }
  return BASE_RETRY_DELAY_MS;
}

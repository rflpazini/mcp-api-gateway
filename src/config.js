const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_RESPONSE_SIZE = 102400;

export function parseEnvironmentConfig(env = process.env) {
  const configs = [];

  let index = 1;

  while (env[`API_${index}_NAME`]) {
    const name = env[`API_${index}_NAME`];
    const swaggerUrl = env[`API_${index}_SWAGGER_URL`];

    if (!swaggerUrl) {
      throw new Error(
        `API_${index}: NAME is set ('${name}') but SWAGGER_URL is missing. ` +
        `Set API_${index}_SWAGGER_URL to the Swagger/OpenAPI spec URL.`
      );
    }

    const config = {
      name,
      swaggerUrl,
      baseUrl: env[`API_${index}_BASE_URL`] || '',
      headers: {},
      timeout: parseIntWithDefault(env[`API_${index}_TIMEOUT`] || env['DEFAULT_TIMEOUT'], DEFAULT_TIMEOUT),
      maxRetries: parseIntWithDefault(env[`API_${index}_MAX_RETRIES`] || env['DEFAULT_MAX_RETRIES'], DEFAULT_MAX_RETRIES),
      pathPrefixes: parseCommaSeparated(env[`API_${index}_PATH_PREFIX`]),
      tags: parseCommaSeparated(env[`API_${index}_TAGS`]),
      excludeParams: parseCommaSeparated(env[`API_${index}_EXCLUDE_PARAMS`]),
      schemaMode: env[`API_${index}_SCHEMA_MODE`] || 'full',
      toolMode: env[`API_${index}_TOOL_MODE`] || 'individual',
    };

    const headersEnv = env[`API_${index}_HEADERS`];
    if (headersEnv) {
      try {
        config.headers = JSON.parse(headersEnv);
      } catch (e) {
        console.error(`Failed to parse headers for API_${index}:`, e);
      }
    }

    const envKeys = Object.keys(env);
    const headerPrefix = `API_${index}_HEADER_`;

    envKeys.forEach(key => {
      if (key.startsWith(headerPrefix)) {
        const headerName = key.substring(headerPrefix.length).replace(/_/g, '-');
        config.headers[headerName] = env[key];
      }
    });

    configs.push(config);
    index++;
  }

  return configs;
}

export function getMaxResponseSize(env = process.env) {
  return parseIntWithDefault(env['MAX_RESPONSE_SIZE'], DEFAULT_MAX_RESPONSE_SIZE);
}

function parseIntWithDefault(value, defaultValue) {
  if (value === undefined || value === null) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) || parsed <= 0 ? defaultValue : parsed;
}

function parseCommaSeparated(value) {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

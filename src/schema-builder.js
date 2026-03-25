const HTTP_METHODS_WITH_BODY = ['post', 'put', 'patch'];

const SCHEMA_KEYS_TO_PRESERVE = [
  'type', 'description', 'enum', 'format', 'minimum', 'maximum',
  'pattern', 'default', 'items', 'minItems', 'maxItems',
  'minLength', 'maxLength', 'properties', 'required',
  'allOf', 'oneOf', 'anyOf', 'not', 'additionalProperties',
  'nullable'
];

export function buildInputSchema(operation, method, excludeParams = new Set()) {
  const schema = {
    type: 'object',
    properties: {},
    required: []
  };

  if (operation.parameters) {
    for (const param of operation.parameters) {
      if (excludeParams.has(param.name)) continue;

      if (param.in === 'query' || param.in === 'path' || param.in === 'header') {
        schema.properties[param.name] = extractParamSchema(param);

        if (param.required) {
          schema.required.push(param.name);
        }
      }
    }
  }

  if (HTTP_METHODS_WITH_BODY.includes(method) && operation.requestBody) {
    const content = operation.requestBody.content?.['application/json'];
    if (content?.schema) {
      schema.properties.body = sanitizeSchema(content.schema);

      if (operation.requestBody.required) {
        schema.required.push('body');
      }
    }
  }

  return schema;
}

function extractParamSchema(param) {
  const base = {
    type: param.schema?.type || 'string',
    description: param.description
  };

  if (param.schema) {
    for (const key of SCHEMA_KEYS_TO_PRESERVE) {
      if (key !== 'type' && key !== 'description' && param.schema[key] !== undefined) {
        base[key] = param.schema[key];
      }
    }
  }

  return base;
}

function sanitizeSchema(schema) {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object' };
  }

  const result = {};

  for (const key of SCHEMA_KEYS_TO_PRESERVE) {
    if (schema[key] === undefined) {
      continue;
    }

    if (key === 'properties' && typeof schema[key] === 'object') {
      result.properties = {};
      for (const [propName, propSchema] of Object.entries(schema[key])) {
        result.properties[propName] = sanitizeSchema(propSchema);
      }
    } else if (key === 'items' && typeof schema[key] === 'object') {
      result.items = sanitizeSchema(schema[key]);
    } else if ((key === 'allOf' || key === 'oneOf' || key === 'anyOf') && Array.isArray(schema[key])) {
      result[key] = schema[key].map(s => sanitizeSchema(s));
    } else {
      result[key] = schema[key];
    }
  }

  if (!result.type && !result.allOf && !result.oneOf && !result.anyOf) {
    result.type = 'object';
  }

  if (schema.description) {
    result.description = schema.description;
  }

  return result;
}

const MAX_ENUM_DISPLAY = 10;
const MAX_BODY_DEPTH = 2;

export function compactSchema(schema) {
  if (!schema || schema.type !== 'object') return schema;

  const required = new Set(schema.required || []);
  const compacted = {
    type: 'object',
    properties: {},
    required: [...required],
  };

  const optionalSummaries = [];

  for (const [name, propSchema] of Object.entries(schema.properties || {})) {
    if (required.has(name)) {
      compacted.properties[name] = compactPropertySchema(propSchema);
    } else {
      optionalSummaries.push(summarizeParam(name, propSchema));
    }
  }

  if (optionalSummaries.length > 0) {
    const existingDesc = compacted.description || '';
    compacted.description = [
      existingDesc,
      `Optional params: ${optionalSummaries.join(', ')}`,
    ].filter(Boolean).join('\n');
  }

  return compacted;
}

function compactPropertySchema(propSchema) {
  if (!propSchema || typeof propSchema !== 'object') return propSchema;

  const result = { ...propSchema };

  if (result.enum && result.enum.length > MAX_ENUM_DISPLAY) {
    const preview = result.enum.slice(0, MAX_ENUM_DISPLAY).join(', ');
    result.description = `${result.description || result.type || 'string'}, one of: ${preview}... (${result.enum.length} total)`;
    delete result.enum;
  }

  if (result.properties) {
    result.properties = compactNestedProperties(result.properties, 1);
  }

  return result;
}

function compactNestedProperties(properties, depth) {
  if (depth >= MAX_BODY_DEPTH) {
    return undefined;
  }

  const result = {};
  for (const [name, schema] of Object.entries(properties)) {
    const compacted = { ...schema };

    if (compacted.enum && compacted.enum.length > MAX_ENUM_DISPLAY) {
      const preview = compacted.enum.slice(0, MAX_ENUM_DISPLAY).join(', ');
      compacted.description = `${compacted.description || compacted.type || 'string'}, one of: ${preview}... (${compacted.enum.length} total)`;
      delete compacted.enum;
    }

    if (compacted.properties) {
      compacted.properties = compactNestedProperties(compacted.properties, depth + 1);
      if (!compacted.properties) {
        compacted.description = (compacted.description || '') + ' (nested object, see API docs)';
        delete compacted.properties;
      }
    }

    result[name] = compacted;
  }

  return result;
}

function summarizeParam(name, schema) {
  const type = schema.type || 'string';

  if (schema.enum) {
    if (schema.enum.length <= 3) {
      return `${name} (${type}: ${schema.enum.join('|')})`;
    }
    return `${name} (${type}, ${schema.enum.length} values)`;
  }

  if (schema.default !== undefined) {
    return `${name} (${type}, default: ${schema.default})`;
  }

  return `${name} (${type})`;
}

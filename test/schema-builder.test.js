import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildInputSchema } from '../src/schema-builder.js';

describe('buildInputSchema', () => {
  it('builds schema for query and path parameters', () => {
    const operation = {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Pet ID' },
        { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filter by status' },
      ]
    };

    const schema = buildInputSchema(operation, 'get');
    assert.equal(schema.properties.id.type, 'integer');
    assert.equal(schema.properties.id.description, 'Pet ID');
    assert.equal(schema.properties.status.type, 'string');
    assert.deepStrictEqual(schema.required, ['id']);
  });

  it('includes header parameters', () => {
    const operation = {
      parameters: [
        { name: 'X-Request-Id', in: 'header', schema: { type: 'string' }, description: 'Request ID' },
      ]
    };

    const schema = buildInputSchema(operation, 'get');
    assert.equal(schema.properties['X-Request-Id'].type, 'string');
  });

  it('preserves enum values in parameters', () => {
    const operation = {
      parameters: [
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive'] } },
      ]
    };

    const schema = buildInputSchema(operation, 'get');
    assert.deepStrictEqual(schema.properties.status.enum, ['active', 'inactive']);
  });

  it('preserves format, minimum, maximum, pattern', () => {
    const operation = {
      parameters: [
        {
          name: 'age', in: 'query',
          schema: { type: 'integer', minimum: 0, maximum: 150, format: 'int32' }
        },
      ]
    };

    const schema = buildInputSchema(operation, 'get');
    assert.equal(schema.properties.age.format, 'int32');
    assert.equal(schema.properties.age.minimum, 0);
    assert.equal(schema.properties.age.maximum, 150);
  });

  it('handles request body with nested properties', () => {
    const operation = {
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                address: {
                  type: 'object',
                  properties: {
                    street: { type: 'string' },
                    city: { type: 'string' },
                    zip: { type: 'string', pattern: '^[0-9]{5}$' },
                  }
                }
              }
            }
          }
        }
      }
    };

    const schema = buildInputSchema(operation, 'post');
    assert.equal(schema.properties.body.type, 'object');
    assert.equal(schema.properties.body.properties.name.type, 'string');
    assert.equal(schema.properties.body.properties.address.type, 'object');
    assert.equal(schema.properties.body.properties.address.properties.zip.pattern, '^[0-9]{5}$');
    assert.ok(schema.required.includes('body'));
  });

  it('handles array types with items', () => {
    const operation = {
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                }
              }
            }
          }
        }
      }
    };

    const schema = buildInputSchema(operation, 'post');
    assert.equal(schema.properties.body.properties.tags.type, 'array');
    assert.equal(schema.properties.body.properties.tags.items.type, 'string');
    assert.equal(schema.properties.body.properties.tags.minItems, 1);
  });

  it('handles allOf composition', () => {
    const operation = {
      requestBody: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                { type: 'object', properties: { id: { type: 'integer' } } },
                { type: 'object', properties: { name: { type: 'string' } } },
              ]
            }
          }
        }
      }
    };

    const schema = buildInputSchema(operation, 'post');
    assert.ok(schema.properties.body.allOf);
    assert.equal(schema.properties.body.allOf.length, 2);
    assert.equal(schema.properties.body.allOf[0].properties.id.type, 'integer');
  });

  it('handles oneOf composition', () => {
    const operation = {
      requestBody: {
        content: {
          'application/json': {
            schema: {
              oneOf: [
                { type: 'object', properties: { email: { type: 'string' } } },
                { type: 'object', properties: { phone: { type: 'string' } } },
              ]
            }
          }
        }
      }
    };

    const schema = buildInputSchema(operation, 'post');
    assert.ok(schema.properties.body.oneOf);
    assert.equal(schema.properties.body.oneOf.length, 2);
  });

  it('ignores non-body for GET requests', () => {
    const operation = {
      parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
      requestBody: {
        content: { 'application/json': { schema: { type: 'object' } } }
      }
    };

    const schema = buildInputSchema(operation, 'get');
    assert.equal(schema.properties.body, undefined);
  });

  it('handles operation with no parameters', () => {
    const operation = {};
    const schema = buildInputSchema(operation, 'get');
    assert.deepStrictEqual(schema.properties, {});
    assert.deepStrictEqual(schema.required, []);
  });
});

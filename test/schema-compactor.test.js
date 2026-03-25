import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compactSchema } from '../src/schema-compactor.js';

describe('compactSchema', () => {
  it('keeps required params in properties with full schema', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'User ID' },
        name: { type: 'string' },
      },
      required: ['id'],
    };

    const result = compactSchema(schema);
    assert.ok(result.properties.id);
    assert.equal(result.properties.id.type, 'integer');
    assert.equal(result.properties.name, undefined);
  });

  it('moves optional params to description string', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        status: { type: 'string' },
        page: { type: 'integer', default: 1 },
      },
      required: ['id'],
    };

    const result = compactSchema(schema);
    assert.ok(result.description.includes('Optional params:'));
    assert.ok(result.description.includes('status (string)'));
    assert.ok(result.description.includes('page (integer, default: 1)'));
  });

  it('strips large enums (>10 values) from required params', () => {
    const largeEnum = Array.from({ length: 50 }, (_, i) => `val${i}`);
    const schema = {
      type: 'object',
      properties: {
        region: { type: 'string', enum: largeEnum, description: 'Region code' },
      },
      required: ['region'],
    };

    const result = compactSchema(schema);
    assert.equal(result.properties.region.enum, undefined);
    assert.ok(result.properties.region.description.includes('50 total'));
    assert.ok(result.properties.region.description.includes('val0'));
  });

  it('preserves small enums (<=10 values) in optional summary', () => {
    const schema = {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'inactive'] },
      },
      required: [],
    };

    const result = compactSchema(schema);
    assert.ok(result.description.includes('active|inactive'));
  });

  it('truncates nested body properties beyond depth 2', () => {
    const schema = {
      type: 'object',
      properties: {
        body: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                address: {
                  type: 'object',
                  properties: {
                    zip: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      required: ['body'],
    };

    const result = compactSchema(schema);
    assert.ok(result.properties.body);
    assert.ok(result.properties.body.properties.user);
    assert.equal(result.properties.body.properties.user.properties, undefined);
    assert.ok(result.properties.body.properties.user.description.includes('see API docs'));
  });

  it('returns non-object schemas unchanged', () => {
    const schema = { type: 'string' };
    assert.deepStrictEqual(compactSchema(schema), schema);
  });

  it('handles schema with no properties', () => {
    const schema = { type: 'object', properties: {}, required: [] };
    const result = compactSchema(schema);
    assert.deepStrictEqual(result.properties, {});
  });
});

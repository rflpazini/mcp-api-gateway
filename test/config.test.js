import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvironmentConfig, getMaxResponseSize } from '../src/config.js';

describe('parseEnvironmentConfig', () => {
  it('returns empty array when no APIs configured', () => {
    const configs = parseEnvironmentConfig({});
    assert.deepStrictEqual(configs, []);
  });

  it('parses a single API config', () => {
    const env = {
      API_1_NAME: 'petstore',
      API_1_SWAGGER_URL: 'https://petstore.swagger.io/v2/swagger.json',
      API_1_BASE_URL: 'https://petstore.swagger.io/v2',
    };

    const configs = parseEnvironmentConfig(env);
    assert.equal(configs.length, 1);
    assert.equal(configs[0].name, 'petstore');
    assert.equal(configs[0].swaggerUrl, 'https://petstore.swagger.io/v2/swagger.json');
    assert.equal(configs[0].baseUrl, 'https://petstore.swagger.io/v2');
  });

  it('parses multiple API configs', () => {
    const env = {
      API_1_NAME: 'users',
      API_1_SWAGGER_URL: 'https://users.api/swagger.json',
      API_2_NAME: 'orders',
      API_2_SWAGGER_URL: 'https://orders.api/swagger.json',
    };

    const configs = parseEnvironmentConfig(env);
    assert.equal(configs.length, 2);
    assert.equal(configs[0].name, 'users');
    assert.equal(configs[1].name, 'orders');
  });

  it('parses JSON headers', () => {
    const env = {
      API_1_NAME: 'test',
      API_1_SWAGGER_URL: 'https://test.api/swagger.json',
      API_1_HEADERS: '{"Authorization":"Bearer token123","X-Custom":"value"}',
    };

    const configs = parseEnvironmentConfig(env);
    assert.equal(configs[0].headers['Authorization'], 'Bearer token123');
    assert.equal(configs[0].headers['X-Custom'], 'value');
  });

  it('parses individual header env vars', () => {
    const env = {
      API_1_NAME: 'test',
      API_1_SWAGGER_URL: 'https://test.api/swagger.json',
      API_1_HEADER_AUTHORIZATION: 'Bearer mytoken',
      API_1_HEADER_X_API_KEY: 'key123',
    };

    const configs = parseEnvironmentConfig(env);
    assert.equal(configs[0].headers['AUTHORIZATION'], 'Bearer mytoken');
    assert.equal(configs[0].headers['X-API-KEY'], 'key123');
  });

  it('throws when NAME is set but SWAGGER_URL is missing', () => {
    const env = {
      API_1_NAME: 'broken',
    };

    assert.throws(
      () => parseEnvironmentConfig(env),
      /SWAGGER_URL is missing/
    );
  });

  it('uses default timeout when not specified', () => {
    const env = {
      API_1_NAME: 'test',
      API_1_SWAGGER_URL: 'https://test.api/swagger.json',
    };

    const configs = parseEnvironmentConfig(env);
    assert.equal(configs[0].timeout, 30000);
  });

  it('uses custom timeout from env', () => {
    const env = {
      API_1_NAME: 'test',
      API_1_SWAGGER_URL: 'https://test.api/swagger.json',
      API_1_TIMEOUT: '5000',
    };

    const configs = parseEnvironmentConfig(env);
    assert.equal(configs[0].timeout, 5000);
  });

  it('uses custom max retries from env', () => {
    const env = {
      API_1_NAME: 'test',
      API_1_SWAGGER_URL: 'https://test.api/swagger.json',
      API_1_MAX_RETRIES: '5',
    };

    const configs = parseEnvironmentConfig(env);
    assert.equal(configs[0].maxRetries, 5);
  });

  it('defaults baseUrl to empty string', () => {
    const env = {
      API_1_NAME: 'test',
      API_1_SWAGGER_URL: 'https://test.api/swagger.json',
    };

    const configs = parseEnvironmentConfig(env);
    assert.equal(configs[0].baseUrl, '');
  });
});

describe('getMaxResponseSize', () => {
  it('returns default 100KB when not set', () => {
    assert.equal(getMaxResponseSize({}), 102400);
  });

  it('returns custom value from env', () => {
    assert.equal(getMaxResponseSize({ MAX_RESPONSE_SIZE: '50000' }), 50000);
  });
});

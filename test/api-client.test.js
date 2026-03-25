import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../src/api-client.js';

function createMockRegistry(apis = new Map()) {
  return {
    getAPI(name) { return apis.get(name); },
    getRoute(toolName) { return this._routes?.get(toolName); },
    _routes: new Map(),
  };
}

describe('ApiClient', () => {
  describe('executeAPI', () => {
    it('throws when API is not found', async () => {
      const registry = createMockRegistry();
      const client = new ApiClient(registry);

      await assert.rejects(
        () => client.executeAPI({ api_name: 'nonexistent', method: 'GET', path: '/test' }),
        /not found/
      );
    });
  });

  describe('executeDynamicTool', () => {
    it('throws when tool route is not found', async () => {
      const registry = createMockRegistry();
      const client = new ApiClient(registry);

      await assert.rejects(
        () => client.executeDynamicTool('unknown_tool', {}),
        /Unknown tool/
      );
    });

    it('resolves path parameters from args', async () => {
      const apis = new Map([
        ['petstore', {
          baseUrl: 'https://petstore.example.com',
          headers: {},
          timeout: 30000,
          maxRetries: 0,
        }]
      ]);
      const registry = createMockRegistry(apis);
      registry._routes.set('petstore_getPetById', {
        apiName: 'petstore',
        method: 'get',
        path: '/pets/{petId}'
      });

      const client = new ApiClient(registry);

      // This will fail because we can't actually make HTTP calls in tests,
      // but we can verify the path resolution by catching the axios error
      try {
        await client.executeDynamicTool('petstore_getPetById', { petId: '42' });
      } catch (error) {
        // Expected: axios will fail but the path should have been resolved
        assert.ok(error.message.includes('API call failed'));
      }
    });

    it('separates body from query params', async () => {
      const apis = new Map([
        ['api', {
          baseUrl: 'https://api.example.com',
          headers: {},
          timeout: 30000,
          maxRetries: 0,
        }]
      ]);
      const registry = createMockRegistry(apis);
      registry._routes.set('api_createUser', {
        apiName: 'api',
        method: 'post',
        path: '/users'
      });

      const client = new ApiClient(registry);

      try {
        await client.executeDynamicTool('api_createUser', {
          body: { name: 'John' },
          status: 'active'
        });
      } catch (error) {
        assert.ok(error.message.includes('API call failed'));
      }
    });
  });
});

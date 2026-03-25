import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApiRegistry } from '../src/api-registry.js';

describe('ApiRegistry', () => {
  describe('generateToolName', () => {
    it('uses operationId when available', () => {
      const registry = new ApiRegistry();
      const name = registry.generateToolName('petstore', 'get', '/pets/{petId}', 'getPetById');

      assert.equal(name, 'petstore_getPetById');
    });

    it('falls back to method and path when no operationId', () => {
      const registry = new ApiRegistry();
      const name = registry.generateToolName('petstore', 'get', '/pets/{petId}');

      assert.equal(name, 'petstore_get__pets__petId_');
    });

    it('sanitizes non-alphanumeric chars in operationId', () => {
      const registry = new ApiRegistry();
      const name = registry.generateToolName('api', 'post', '/users', 'create-user.v2');

      assert.equal(name, 'api_create_user_v2');
    });

    it('disambiguates collisions with method before numeric suffix', () => {
      const registry = new ApiRegistry();
      const name1 = registry.generateToolName('api', 'get', '/users', 'listUsers');
      const name2 = registry.generateToolName('api', 'post', '/users', 'listUsers');

      assert.equal(name1, 'api_listUsers');
      assert.equal(name2, 'api_post_listUsers');
    });

    it('uses numeric suffix when method disambiguation also collides', () => {
      const registry = new ApiRegistry();
      registry.generateToolName('api', 'get', '/a', 'op');
      registry.generateToolName('api', 'get', '/b', 'op');
      const name3 = registry.generateToolName('api', 'get', '/c', 'op');

      assert.equal(name3, 'api_op_2');
    });
  });

  describe('toolRouteMap', () => {
    it('stores and retrieves route by tool name', () => {
      const registry = new ApiRegistry();
      registry.generateToolName('myapi', 'get', '/users/{userId}', 'getUser');

      const route = registry.getRoute('myapi_getUser');
      assert.deepStrictEqual(route, {
        apiName: 'myapi',
        method: 'get',
        path: '/users/{userId}'
      });
    });

    it('returns undefined for unknown tool name', () => {
      const registry = new ApiRegistry();
      assert.equal(registry.getRoute('nonexistent'), undefined);
    });

    it('correctly maps tools with underscores in API name', () => {
      const registry = new ApiRegistry();
      registry.generateToolName('my_api', 'get', '/user_groups/{group_id}', 'getUserGroup');

      const route = registry.getRoute('my_api_getUserGroup');
      assert.equal(route.apiName, 'my_api');
      assert.equal(route.path, '/user_groups/{group_id}');
    });
  });

  describe('loadAPIs', () => {
    it('logs message when no configs provided', async () => {
      const registry = new ApiRegistry();
      const errors = [];
      const origError = console.error;
      console.error = (...args) => errors.push(args.join(' '));

      await registry.loadAPIs([]);

      console.error = origError;
      assert.ok(errors.some(e => e.includes('No APIs configured')));
    });
  });

  describe('getAPI / getAllAPIs', () => {
    it('returns undefined for unregistered API', () => {
      const registry = new ApiRegistry();
      assert.equal(registry.getAPI('nonexistent'), undefined);
    });

    it('getAllAPIs returns the internal Map', () => {
      const registry = new ApiRegistry();
      const apis = registry.getAllAPIs();
      assert.ok(apis instanceof Map);
      assert.equal(apis.size, 0);
    });
  });
});

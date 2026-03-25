import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { groupEndpoints, buildGroupedTool } from '../src/tool-grouper.js';

const METHODS = ['get', 'post', 'put', 'delete', 'patch'];

function makePaths(pathDefs) {
  const paths = {};
  for (const { path, method, operationId, summary, tags } of pathDefs) {
    if (!paths[path]) paths[path] = {};
    paths[path][method] = { operationId, summary, tags };
  }
  return paths;
}

describe('groupEndpoints', () => {
  it('groups by tag when tags are present', () => {
    const apiData = {
      paths: makePaths([
        { path: '/users', method: 'get', operationId: 'listUsers', tags: ['Users'] },
        { path: '/users/{id}', method: 'get', operationId: 'getUser', tags: ['Users'] },
        { path: '/orders', method: 'get', operationId: 'listOrders', tags: ['Orders'] },
        { path: '/orders/{id}', method: 'get', operationId: 'getOrder', tags: ['Orders'] },
      ]),
    };

    const groups = groupEndpoints('api', apiData, METHODS);
    assert.ok(groups.has('Users'));
    assert.ok(groups.has('Orders'));
    assert.equal(groups.get('Users').length, 2);
    assert.equal(groups.get('Orders').length, 2);
  });

  it('groups by path segment when no tags', () => {
    const apiData = {
      paths: makePaths([
        { path: '/pets', method: 'get', operationId: 'listPets' },
        { path: '/pets/{id}', method: 'get', operationId: 'getPet' },
        { path: '/store/inventory', method: 'get', operationId: 'getInventory' },
        { path: '/store/order', method: 'post', operationId: 'placeOrder' },
      ]),
    };

    const groups = groupEndpoints('api', apiData, METHODS);
    assert.ok(groups.has('pets'));
    assert.ok(groups.has('store'));
    assert.equal(groups.get('pets').length, 2);
    assert.equal(groups.get('store').length, 2);
  });

  it('skips api/version path segments', () => {
    const apiData = {
      paths: makePaths([
        { path: '/api/v3/users', method: 'get', operationId: 'listUsers' },
        { path: '/api/v3/users/{id}', method: 'get', operationId: 'getUser' },
      ]),
    };

    const groups = groupEndpoints('api', apiData, METHODS);
    assert.ok(groups.has('users'));
    assert.equal(groups.get('users').length, 2);
  });

  it('merges single-endpoint groups into other', () => {
    const apiData = {
      paths: makePaths([
        { path: '/users', method: 'get', operationId: 'listUsers' },
        { path: '/users/{id}', method: 'get', operationId: 'getUser' },
        { path: '/health', method: 'get', operationId: 'healthCheck' },
        { path: '/version', method: 'get', operationId: 'getVersion' },
      ]),
    };

    const groups = groupEndpoints('api', apiData, METHODS);
    assert.ok(groups.has('users'));
    assert.ok(groups.has('other'));
    assert.equal(groups.get('other').length, 2);
  });

  it('handles mixed tagged and untagged operations', () => {
    const apiData = {
      paths: makePaths([
        { path: '/users', method: 'get', operationId: 'listUsers', tags: ['Users'] },
        { path: '/users/{id}', method: 'get', operationId: 'getUser', tags: ['Users'] },
        { path: '/internal/debug', method: 'get', operationId: 'debug' },
      ]),
    };

    const groups = groupEndpoints('api', apiData, METHODS);
    assert.ok(groups.has('Users'));
    // untagged endpoint gets path-based group, then merged to other since it's singleton
    assert.equal(groups.get('Users').length, 2);
  });
});

describe('buildGroupedTool', () => {
  it('builds a tool with operation enum and description', () => {
    const operations = [
      { path: '/users', method: 'get', operationId: 'listUsers', summary: 'List all users' },
      { path: '/users', method: 'post', operationId: 'createUser', summary: 'Create a user' },
      { path: '/users/{id}', method: 'get', operationId: 'getUser', summary: 'Get user by ID' },
    ];

    const groupRouteMap = new Map();
    const tool = buildGroupedTool('myapi', 'Users', operations, groupRouteMap);

    assert.equal(tool.name, 'myapi_Users');
    assert.ok(tool.description.includes('listUsers'));
    assert.ok(tool.description.includes('createUser'));
    assert.ok(tool.description.includes('GET /users'));
    assert.ok(tool.description.includes('POST /users'));

    const opEnum = tool.inputSchema.properties.operation.enum;
    assert.ok(opEnum.includes('listUsers'));
    assert.ok(opEnum.includes('createUser'));
    assert.ok(opEnum.includes('getUser'));

    assert.deepStrictEqual(tool.inputSchema.required, ['operation']);
  });

  it('populates groupRouteMap with operation routes', () => {
    const operations = [
      { path: '/pets/{petId}', method: 'get', operationId: 'getPet' },
      { path: '/pets', method: 'post', operationId: 'addPet' },
    ];

    const groupRouteMap = new Map();
    buildGroupedTool('api', 'pets', operations, groupRouteMap);

    const opMap = groupRouteMap.get('api_pets');
    assert.ok(opMap);
    assert.deepStrictEqual(opMap.get('getPet'), { method: 'get', path: '/pets/{petId}' });
    assert.deepStrictEqual(opMap.get('addPet'), { method: 'post', path: '/pets' });
  });

  it('handles duplicate operationIds within a group', () => {
    const operations = [
      { path: '/items', method: 'get', operationId: 'list' },
      { path: '/items/all', method: 'get', operationId: 'list' },
    ];

    const groupRouteMap = new Map();
    const tool = buildGroupedTool('api', 'items', operations, groupRouteMap);

    const opEnum = tool.inputSchema.properties.operation.enum;
    assert.equal(opEnum.length, 2);
    assert.ok(opEnum.includes('list'));
    assert.ok(opEnum.includes('list_2'));
  });

  it('derives operation name from path when no operationId', () => {
    const operations = [
      { path: '/api/v2/users', method: 'get' },
      { path: '/api/v2/users/{id}', method: 'delete' },
    ];

    const groupRouteMap = new Map();
    const tool = buildGroupedTool('api', 'users', operations, groupRouteMap);

    const opEnum = tool.inputSchema.properties.operation.enum;
    assert.ok(opEnum.some(name => name.includes('get')));
    assert.ok(opEnum.some(name => name.includes('delete')));
  });
});

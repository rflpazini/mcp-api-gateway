const SKIP_SEGMENTS = /^(api|v\d+(\.\d+)*|admin)$/i;
const MAX_GROUP_SIZE = 30;
const MAX_GROUPS = 50;
const OTHER_GROUP = 'other';

export function groupEndpoints(apiName, apiData, supportedMethods) {
  const operations = collectOperations(apiData.paths, supportedMethods);
  const hasAnyTags = operations.some(op => op.tags && op.tags.length > 0);

  const groups = new Map();

  for (const op of operations) {
    const groupName = hasAnyTags
      ? getTagGroup(op)
      : getPathGroup(op.path);

    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName).push(op);
  }

  mergeSingletons(groups);
  splitLargeGroups(groups);
  capGroupCount(groups);

  return groups;
}

export function buildGroupedTool(apiName, groupName, operations, groupRouteMap) {
  const sanitizedGroup = groupName.replace(/[^a-zA-Z0-9_]/g, '_');
  const toolName = `${apiName}_${sanitizedGroup}`;

  const operationEntries = new Map();
  const operationLines = [];

  for (const op of operations) {
    const opName = deriveOperationName(op);

    let uniqueName = opName;
    if (operationEntries.has(uniqueName)) {
      let suffix = 2;
      while (operationEntries.has(`${uniqueName}_${suffix}`)) suffix++;
      uniqueName = `${uniqueName}_${suffix}`;
    }

    operationEntries.set(uniqueName, { method: op.method, path: op.path });
    const summary = op.summary ? ` - ${op.summary}` : '';
    operationLines.push(`- ${uniqueName}: ${op.method.toUpperCase()} ${op.path}${summary}`);
  }

  groupRouteMap.set(toolName, operationEntries);

  const description = [
    `Endpoints for ${groupName}.`,
    `Available operations:`,
    ...operationLines,
  ].join('\n');

  const operationEnum = [...operationEntries.keys()];

  return {
    name: toolName,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: operationEnum,
          description: 'The operation to execute',
        },
        path_params: {
          type: 'object',
          description: 'Path parameters as key-value pairs (e.g., {"userId": "123"})',
        },
        params: {
          type: 'object',
          description: 'Query parameters',
        },
        body: {
          type: 'object',
          description: 'Request body for POST/PUT/PATCH operations',
        },
        headers: {
          type: 'object',
          description: 'Additional headers',
        },
      },
      required: ['operation'],
    },
  };
}

function collectOperations(paths, supportedMethods) {
  const operations = [];

  for (const [path, pathData] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathData)) {
      if (supportedMethods.includes(method)) {
        operations.push({
          path,
          method,
          operationId: operation.operationId,
          summary: operation.summary,
          tags: operation.tags,
        });
      }
    }
  }

  return operations;
}

function getTagGroup(op) {
  if (op.tags && op.tags.length > 0) {
    return op.tags[0];
  }
  return getPathGroup(op.path);
}

function getPathGroup(path) {
  const segments = path.split('/').filter(Boolean);

  for (const segment of segments) {
    if (segment.startsWith('{')) continue;
    if (SKIP_SEGMENTS.test(segment)) continue;
    return segment;
  }

  return OTHER_GROUP;
}

function deriveOperationName(op) {
  if (op.operationId) {
    return op.operationId.replace(/[^a-zA-Z0-9_]/g, '_');
  }
  const pathPart = op.path
    .split('/')
    .filter(s => s && !s.startsWith('{'))
    .slice(-2)
    .join('_');

  return `${op.method}_${pathPart || 'root'}`;
}

function mergeSingletons(groups) {
  const singletons = [];

  for (const [name, ops] of groups) {
    if (ops.length === 1 && name !== OTHER_GROUP) {
      singletons.push(name);
    }
  }

  if (singletons.length === 0) return;

  if (!groups.has(OTHER_GROUP)) {
    groups.set(OTHER_GROUP, []);
  }

  for (const name of singletons) {
    groups.get(OTHER_GROUP).push(...groups.get(name));
    groups.delete(name);
  }
}

function splitLargeGroups(groups) {
  const toSplit = [];

  for (const [name, ops] of groups) {
    if (ops.length > MAX_GROUP_SIZE && name !== OTHER_GROUP) {
      toSplit.push(name);
    }
  }

  for (const name of toSplit) {
    const ops = groups.get(name);
    groups.delete(name);

    const subGroups = new Map();

    for (const op of ops) {
      const segments = op.path.split('/').filter(Boolean);
      const resourceIdx = segments.findIndex(s => !SKIP_SEGMENTS.test(s) && !s.startsWith('{'));
      const nextIdx = segments.findIndex((s, i) => i > resourceIdx && !SKIP_SEGMENTS.test(s) && !s.startsWith('{'));
      const subName = nextIdx >= 0 ? `${name}_${segments[nextIdx]}` : name;

      if (!subGroups.has(subName)) {
        subGroups.set(subName, []);
      }
      subGroups.get(subName).push(op);
    }

    for (const [subName, subOps] of subGroups) {
      groups.set(subName, subOps);
    }
  }
}

function capGroupCount(groups) {
  if (groups.size <= MAX_GROUPS) return;

  const sorted = [...groups.entries()]
    .filter(([name]) => name !== OTHER_GROUP)
    .sort((a, b) => a[1].length - b[1].length);

  if (!groups.has(OTHER_GROUP)) {
    groups.set(OTHER_GROUP, []);
  }

  while (groups.size > MAX_GROUPS && sorted.length > 0) {
    const [name, ops] = sorted.shift();
    groups.get(OTHER_GROUP).push(...ops);
    groups.delete(name);
  }
}

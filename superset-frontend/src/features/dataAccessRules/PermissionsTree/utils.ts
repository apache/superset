/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import type {
  PermissionNode,
  PermissionState,
  PermissionsPayload,
  PermissionEntry,
  NodeType,
  CLSAction,
  RLSRule,
} from './types';

// Key format: db:{id}|cat:{name}|schema:{name}|table:{name}
// Each part is optional based on the level

export function makeKey(parts: {
  databaseId: number;
  catalogName?: string;
  schemaName?: string;
  tableName?: string;
}): string {
  let key = `db:${parts.databaseId}`;
  if (parts.catalogName) {
    key += `|cat:${parts.catalogName}`;
  }
  if (parts.schemaName) {
    key += `|schema:${parts.schemaName}`;
  }
  if (parts.tableName) {
    key += `|table:${parts.tableName}`;
  }
  return key;
}

export function parseKey(key: string): {
  databaseId: number;
  catalogName?: string;
  schemaName?: string;
  tableName?: string;
  nodeType: NodeType;
} {
  const parts = key.split('|');
  const result: ReturnType<typeof parseKey> = {
    databaseId: 0,
    nodeType: 'database',
  };

  for (const part of parts) {
    if (part.startsWith('db:')) {
      result.databaseId = parseInt(part.slice(3), 10);
    } else if (part.startsWith('cat:')) {
      result.catalogName = part.slice(4);
      result.nodeType = 'catalog';
    } else if (part.startsWith('schema:')) {
      result.schemaName = part.slice(7);
      result.nodeType = 'schema';
    } else if (part.startsWith('table:')) {
      result.tableName = part.slice(6);
      result.nodeType = 'table';
    }
  }

  return result;
}

export function getParentKey(key: string): string | null {
  const parts = key.split('|');
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join('|');
}

export function getEffectiveState(
  nodeKey: string,
  permissionStates: Record<string, PermissionState>,
): PermissionState {
  // Check if node has explicit state
  const explicitState = permissionStates[nodeKey];
  if (explicitState && explicitState !== 'inherit') {
    return explicitState;
  }

  // Walk up ancestors to find effective state
  let currentKey: string | null = nodeKey;
  while (currentKey) {
    const parentKey = getParentKey(currentKey);
    if (!parentKey) break;

    const parentState = permissionStates[parentKey];
    if (parentState && parentState !== 'inherit') {
      return parentState;
    }
    currentKey = parentKey;
  }

  // Default is deny (implicit)
  return 'deny';
}

export function getExplicitState(
  nodeKey: string,
  permissionStates: Record<string, PermissionState>,
): PermissionState {
  return permissionStates[nodeKey] || 'inherit';
}

export function cyclePermissionState(
  nodeKey: string,
  permissionStates: Record<string, PermissionState>,
): Record<string, PermissionState> {
  const newStates = { ...permissionStates };
  const currentState = newStates[nodeKey] || 'inherit';
  const parentKey = getParentKey(nodeKey);

  let nextState: PermissionState;

  if (!parentKey) {
    // Root element (database) - cycle through all three states
    if (currentState === 'inherit') {
      nextState = 'allow';
    } else if (currentState === 'allow') {
      nextState = 'deny';
    } else {
      nextState = 'inherit';
    }
  } else {
    // Child element - toggle between inherit and opposite of parent's effective state
    const parentEffective = getEffectiveState(parentKey, permissionStates);
    const oppositeState = parentEffective === 'allow' ? 'deny' : 'allow';

    if (currentState === 'inherit') {
      nextState = oppositeState;
    } else {
      nextState = 'inherit';
    }
  }

  // Apply the new state
  if (nextState === 'inherit') {
    delete newStates[nodeKey];
  } else {
    newStates[nodeKey] = nextState;
  }

  // Clear all descendant states when setting a non-inherit state on a parent
  // This ensures children return to "inherit" when parent is set
  if (nextState !== 'inherit') {
    clearDescendantStates(nodeKey, newStates);
  }

  return newStates;
}

/**
 * Clear all permission states for descendants of a given node key.
 */
function clearDescendantStates(
  parentKey: string,
  states: Record<string, PermissionState>,
): void {
  const keysToDelete: string[] = [];

  Object.keys(states).forEach(key => {
    if (isDescendantOf(key, parentKey)) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => {
    delete states[key];
  });
}

/**
 * Check if a key is a descendant of another key.
 */
function isDescendantOf(childKey: string, ancestorKey: string): boolean {
  // A key is a descendant if it starts with the ancestor key + '|'
  return childKey.startsWith(`${ancestorKey}|`);
}

/**
 * Count children with explicit allow/deny states.
 * Returns counts for direct children only (not all descendants).
 */
export function countChildPermissions(
  parentKey: string,
  permissionStates: Record<string, PermissionState>,
): { allowed: number; denied: number } {
  let allowed = 0;
  let denied = 0;

  Object.entries(permissionStates).forEach(([key, state]) => {
    // Check if this is a direct child (parent key + one more segment)
    if (isDirectChildOf(key, parentKey)) {
      if (state === 'allow') {
        allowed += 1;
      } else if (state === 'deny') {
        denied += 1;
      }
    }
  });

  return { allowed, denied };
}

/**
 * Count all descendants with explicit allow/deny states.
 */
export function countDescendantPermissions(
  parentKey: string,
  permissionStates: Record<string, PermissionState>,
): { allowed: number; denied: number } {
  let allowed = 0;
  let denied = 0;

  Object.entries(permissionStates).forEach(([key, state]) => {
    if (isDescendantOf(key, parentKey)) {
      if (state === 'allow') {
        allowed += 1;
      } else if (state === 'deny') {
        denied += 1;
      }
    }
  });

  return { allowed, denied };
}

/**
 * Check if a key is a direct child of another key.
 */
function isDirectChildOf(childKey: string, parentKey: string): boolean {
  if (!childKey.startsWith(`${parentKey}|`)) {
    return false;
  }
  // Count the number of '|' segments after the parent
  const suffix = childKey.slice(parentKey.length + 1);
  return !suffix.includes('|');
}

export function updateTreeData(
  list: PermissionNode[],
  key: string,
  children: PermissionNode[],
): PermissionNode[] {
  return list.map(node => {
    if (node.key === key) {
      return {
        ...node,
        children,
      };
    }
    if (node.children) {
      return {
        ...node,
        children: updateTreeData(node.children, key, children),
      };
    }
    return node;
  });
}

export function findNodeByKey(
  data: PermissionNode[],
  key: string,
): PermissionNode | null {
  for (const node of data) {
    if (node.key === key) return node;
    if (node.children) {
      const found = findNodeByKey(node.children, key);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Make a CLS key from a table key and column name.
 * Format: "{tableKey}::{columnName}"
 */
export function makeClsKey(tableKey: string, columnName: string): string {
  return `${tableKey}::${columnName}`;
}

/**
 * Parse a CLS key into table key and column name.
 */
export function parseClsKey(clsKey: string): {
  tableKey: string;
  columnName: string;
} | null {
  const separatorIndex = clsKey.indexOf('::');
  if (separatorIndex === -1) return null;
  return {
    tableKey: clsKey.slice(0, separatorIndex),
    columnName: clsKey.slice(separatorIndex + 2),
  };
}

/**
 * Get CLS rules for a specific table from the clsRules state.
 */
export function getTableClsRules(
  tableKey: string,
  clsRules: Record<string, CLSAction>,
): Record<string, CLSAction> {
  const tableRules: Record<string, CLSAction> = {};
  const prefix = `${tableKey}::`;

  Object.entries(clsRules).forEach(([key, action]) => {
    if (key.startsWith(prefix)) {
      const columnName = key.slice(prefix.length);
      tableRules[columnName] = action;
    }
  });

  return tableRules;
}

export function generatePermissionsPayload(
  permissionStates: Record<string, PermissionState>,
  databases: Map<number, string>,
  clsRules: Record<string, CLSAction> = {},
  rlsRules: Record<string, RLSRule> = {},
): PermissionsPayload {
  const allowed: PermissionEntry[] = [];
  const denied: PermissionEntry[] = [];

  // Clean up states - remove redundant entries
  const cleanedStates = cleanupStates(permissionStates);

  // Group CLS rules by table key
  const clsByTable: Record<string, Record<string, string>> = {};
  Object.entries(clsRules).forEach(([clsKey, action]) => {
    const parsed = parseClsKey(clsKey);
    if (!parsed) return;
    if (!clsByTable[parsed.tableKey]) {
      clsByTable[parsed.tableKey] = {};
    }
    clsByTable[parsed.tableKey][parsed.columnName] = action;
  });

  Object.entries(cleanedStates).forEach(([key, state]) => {
    const parsed = parseKey(key);
    const databaseName = databases.get(parsed.databaseId);

    if (!databaseName) return;

    const entry: PermissionEntry = {
      database: databaseName,
    };

    if (parsed.catalogName) entry.catalog = parsed.catalogName;
    if (parsed.schemaName) entry.schema = parsed.schemaName;
    if (parsed.tableName) entry.table = parsed.tableName;

    // Add RLS rules if this is a table entry and has RLS rules
    if (parsed.tableName && rlsRules[key]) {
      const rls = rlsRules[key];
      if (rls.predicate) {
        entry.rls = {
          predicate: rls.predicate,
        };
        if (rls.groupKey) {
          entry.rls.group_key = rls.groupKey;
        }
      }
    }

    // Add CLS rules if this is a table entry and has CLS rules
    if (parsed.tableName && clsByTable[key]) {
      entry.cls = clsByTable[key];
    }

    if (state === 'allow') {
      allowed.push(entry);
    } else if (state === 'deny') {
      denied.push(entry);
    }
  });

  // Also add RLS/CLS rules for tables that don't have explicit permission states
  // but do have RLS or CLS rules (they inherit permission from parent)
  const tablesWithRules = new Set([
    ...Object.keys(clsByTable),
    ...Object.keys(rlsRules),
  ]);

  tablesWithRules.forEach(tableKey => {
    // Check if we already added this table
    const parsed = parseKey(tableKey);
    const databaseName = databases.get(parsed.databaseId);
    if (!databaseName) return;

    // Only add if not already in allowed list
    const alreadyInAllowed = allowed.some(
      entry =>
        entry.database === databaseName &&
        entry.catalog === parsed.catalogName &&
        entry.schema === parsed.schemaName &&
        entry.table === parsed.tableName,
    );

    const hasClsRules =
      clsByTable[tableKey] && Object.keys(clsByTable[tableKey]).length > 0;
    const hasRlsRules =
      rlsRules[tableKey] && rlsRules[tableKey].predicate;

    if (!alreadyInAllowed && (hasClsRules || hasRlsRules)) {
      // Check if the table has effective allow state (inherited)
      const effectiveState = getEffectiveState(tableKey, permissionStates);
      if (effectiveState === 'allow') {
        const entry: PermissionEntry = {
          database: databaseName,
          table: parsed.tableName,
        };
        if (parsed.catalogName) entry.catalog = parsed.catalogName;
        if (parsed.schemaName) entry.schema = parsed.schemaName;

        if (hasRlsRules) {
          const rls = rlsRules[tableKey];
          entry.rls = { predicate: rls.predicate };
          if (rls.groupKey) {
            entry.rls.group_key = rls.groupKey;
          }
        }

        if (hasClsRules) {
          entry.cls = clsByTable[tableKey];
        }

        allowed.push(entry);
      }
    }
  });

  return { allowed, denied };
}

function cleanupStates(
  states: Record<string, PermissionState>,
): Record<string, PermissionState> {
  const cleaned: Record<string, PermissionState> = {};

  Object.entries(states).forEach(([key, state]) => {
    if (state === 'inherit') return;

    // Check ancestor state
    let ancestorState: PermissionState | null = null;
    let currentKey: string | null = key;
    while (currentKey) {
      const parentKey = getParentKey(currentKey);
      if (!parentKey) break;
      if (states[parentKey] && states[parentKey] !== 'inherit') {
        ancestorState = states[parentKey];
        break;
      }
      currentKey = parentKey;
    }

    // Only keep state if it differs from ancestor
    if (ancestorState) {
      if (ancestorState !== state) {
        cleaned[key] = state;
      }
    } else {
      // No ancestor - only keep 'allow' (deny is default)
      if (state === 'allow') {
        cleaned[key] = state;
      }
    }
  });

  return cleaned;
}

export function loadPermissionsFromPayload(
  payload: PermissionsPayload,
  databases: Map<string, number>,
): {
  states: Record<string, PermissionState>;
  clsRules: Record<string, CLSAction>;
  rlsRules: Record<string, RLSRule>;
} {
  const states: Record<string, PermissionState> = {};
  const clsRules: Record<string, CLSAction> = {};
  const rlsRules: Record<string, RLSRule> = {};

  payload.allowed.forEach(entry => {
    const databaseId = databases.get(entry.database);
    if (databaseId === undefined) return;

    const key = makeKey({
      databaseId,
      catalogName: entry.catalog,
      schemaName: entry.schema,
      tableName: entry.table,
    });
    states[key] = 'allow';

    // Load RLS rules if present
    if (entry.rls && entry.table) {
      rlsRules[key] = {
        predicate: entry.rls.predicate,
        groupKey: entry.rls.group_key,
      };
    }

    // Load CLS rules if present
    if (entry.cls && entry.table) {
      Object.entries(entry.cls).forEach(([columnName, action]) => {
        const clsKey = makeClsKey(key, columnName);
        clsRules[clsKey] = action as CLSAction;
      });
    }
  });

  payload.denied.forEach(entry => {
    const databaseId = databases.get(entry.database);
    if (databaseId === undefined) return;

    const key = makeKey({
      databaseId,
      catalogName: entry.catalog,
      schemaName: entry.schema,
      tableName: entry.table,
    });
    states[key] = 'deny';
  });

  return { states, clsRules, rlsRules };
}

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

import { NODE_CATALOG, isKnownType } from './catalog';
import { validateStyle } from './style';
import {
  CanvasDefinition,
  CdlAction,
  CdlActionName,
  CdlNode,
  isVizNode,
} from './types';

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const VAR_REF = /^\$([A-Za-z_][\w]*)$/;
const EVENT_TOKEN = '$event';
/** The no-code invariant: reject anything that smells like an executable string. */
const CODE_SMELL = /=>|\bfunction\b|new\s+Function/i;
const JS_URL = /^\s*(javascript|data|vbscript):/i;

/**
 * Keyed by the action union, so adding an action to `CdlAction` without
 * declaring its required params is a compile error rather than a runtime
 * "unknown action" that only shows up in the browser.
 */
const ACTION_REQUIRED: Record<CdlActionName, string[]> = {
  setVariable: ['name', 'value'],
  applyFilter: ['col', 'op', 'val'],
  crossFilter: ['col', 'op', 'val'],
  clearFilters: [],
  navigateTab: ['tabsId', 'tab'],
  openModal: ['modalId'],
  closeModal: ['modalId'],
  openUrl: ['url'],
  refresh: [],
};

const isVarRef = (v: unknown): v is string =>
  typeof v === 'string' && VAR_REF.test(v);

const varName = (ref: string): string => ref.slice(1);

/** Deep-scan a value for executable-looking strings (the core safety gate). */
function scanNoCode(
  value: unknown,
  path: string,
  errors: ValidationError[],
): void {
  if (typeof value === 'string') {
    if (CODE_SMELL.test(value)) {
      errors.push({
        path,
        message: `disallowed executable string (no-code invariant): ${value.slice(0, 40)}`,
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanNoCode(v, `${path}[${i}]`, errors));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      // A `formatter` must be a declarative object, never a raw string/function.
      if (k === 'formatter' && typeof v === 'string') {
        errors.push({
          path: `${path}.formatter`,
          message: 'formatter must be a declarative object, not a string',
        });
      }
      scanNoCode(v, `${path}.${k}`, errors);
    });
  }
}

/** Collect every `$var` reference in a value (excluding the `$event` token). */
function collectRefs(value: unknown, out: Set<string>): void {
  if (isVarRef(value) && value !== EVENT_TOKEN) {
    out.add(varName(value));
  } else if (Array.isArray(value)) {
    value.forEach(v => collectRefs(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(v =>
      collectRefs(v, out),
    );
  }
}

function validateAction(
  action: CdlAction,
  path: string,
  declared: Set<string>,
  errors: ValidationError[],
): void {
  const required = ACTION_REQUIRED[action.action];
  if (!required) {
    errors.push({ path, message: `unknown action "${action.action}"` });
    return;
  }
  const record = action as unknown as Record<string, unknown>;
  required.forEach(key => {
    if (record[key] === undefined) {
      errors.push({
        path,
        message: `action "${action.action}" missing "${key}"`,
      });
    }
  });
  if (action.action === 'openUrl' && JS_URL.test(action.url)) {
    errors.push({
      path: `${path}.url`,
      message: 'openUrl allows http(s) only',
    });
  }
  if (action.action === 'setVariable' && !declared.has(action.name)) {
    errors.push({
      path: `${path}.name`,
      message: `undeclared variable "${action.name}"`,
    });
  }
}

function validateNode(
  node: CdlNode,
  path: string,
  declared: Set<string>,
  errors: ValidationError[],
): void {
  if (!node || typeof node !== 'object') {
    errors.push({ path, message: 'node must be an object' });
    return;
  }
  if (typeof node.id !== 'string' || !node.id) {
    errors.push({ path, message: 'node.id (string) is required' });
  }
  if (!isKnownType(node.type)) {
    errors.push({
      path,
      message: `unknown node type "${node.type}" (not in catalog)`,
    });
    return; // can't validate further against an unknown contract
  }
  const entry = NODE_CATALOG[node.type];

  // Required props
  entry.requiredProps.forEach(prop => {
    if (node.props?.[prop] === undefined) {
      errors.push({
        path: `${path}.props.${prop}`,
        message: `required prop "${prop}" missing`,
      });
    }
  });

  // Children only on containers
  if (node.children?.length && !entry.container) {
    errors.push({
      path: `${path}.children`,
      message: `"${node.type}" cannot have children`,
    });
  }

  // bind targets must be bindable + reference declared vars
  Object.entries(node.bind ?? {}).forEach(([prop, ref]) => {
    if (!entry.bindableProps.includes(prop)) {
      errors.push({
        path: `${path}.bind.${prop}`,
        message: `prop "${prop}" is not bindable`,
      });
    }
    if (!isVarRef(ref)) {
      errors.push({
        path: `${path}.bind.${prop}`,
        message: `bind must be a $var reference`,
      });
    } else if (!declared.has(varName(ref))) {
      errors.push({
        path: `${path}.bind.${prop}`,
        message: `undeclared variable "${ref}"`,
      });
    }
  });

  // Events must be in the catalog; actions must be valid
  Object.entries(node.on ?? {}).forEach(([event, actions]) => {
    if (!entry.events.includes(event)) {
      errors.push({
        path: `${path}.on.${event}`,
        message: `"${node.type}" does not emit "${event}"`,
      });
    }
    (actions ?? []).forEach((action, i) =>
      validateAction(action, `${path}.on.${event}[${i}]`, declared, errors),
    );
  });

  // Viz-specific
  if (isVizNode(node)) {
    if (node.renderer === 'echarts') {
      if (!node.data?.queryContext) {
        errors.push({
          path: `${path}.data`,
          message: 'echarts Viz requires data.queryContext',
        });
      }
      if (!node.data?.encoding) {
        errors.push({
          path: `${path}.data`,
          message: 'echarts Viz requires data.encoding',
        });
      }
      scanNoCode(node.option, `${path}.option`, errors);
    } else if (node.renderer === 'supersetChart') {
      if (typeof node.chartId !== 'number') {
        errors.push({
          path: `${path}.chartId`,
          message: 'supersetChart Viz requires chartId',
        });
      }
    } else {
      errors.push({
        path: `${path}.renderer`,
        message: `unknown Viz renderer`,
      });
    }
  }

  // No-code scan over props (option scanned above for Viz)
  scanNoCode(node.props, `${path}.props`, errors);

  // Declarative styling: allowlisted properties, safe values only.
  validateStyle(node.style, `${path}.style`).forEach(message =>
    errors.push({ path: `${path}.style`, message }),
  );

  // Board placement: numeric grid units.
  if (node.layout !== undefined) {
    const layout = node.layout as unknown as Record<string, unknown>;
    (['x', 'y', 'w', 'h'] as const).forEach(key => {
      if (typeof layout[key] !== 'number') {
        errors.push({
          path: `${path}.layout.${key}`,
          message: `${key} must be a number`,
        });
      }
    });
    if (typeof layout.w === 'number' && layout.w < 1) {
      errors.push({
        path: `${path}.layout.w`,
        message: 'w must be at least 1',
      });
    }
    if (typeof layout.h === 'number' && layout.h < 1) {
      errors.push({
        path: `${path}.layout.h`,
        message: 'h must be at least 1',
      });
    }
  }

  // Reference integrity across props / bind / on / data
  const refs = new Set<string>();
  collectRefs(node.props, refs);
  collectRefs(node.on, refs);
  if (isVizNode(node)) collectRefs(node.data?.queryContext, refs);
  refs.forEach(name => {
    if (!declared.has(name)) {
      errors.push({
        path,
        message: `references undeclared variable "$${name}"`,
      });
    }
  });

  node.children?.forEach((child, i) =>
    validateNode(child, `${path}.children[${i}]`, declared, errors),
  );
}

export function validateCanvas(definition: CanvasDefinition): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof definition?.cdlVersion !== 'number') {
    errors.push({
      path: 'cdlVersion',
      message: 'cdlVersion (number) is required',
    });
  }
  if (!definition?.variables || typeof definition.variables !== 'object') {
    errors.push({ path: 'variables', message: 'variables object is required' });
  }
  if (!definition?.tree) {
    errors.push({ path: 'tree', message: 'tree (root node) is required' });
    return { valid: false, errors };
  }

  const declared = new Set(Object.keys(definition.variables ?? {}));
  validateNode(definition.tree, 'tree', declared, errors);

  return { valid: errors.length === 0, errors };
}

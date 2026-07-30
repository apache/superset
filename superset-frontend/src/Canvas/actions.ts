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

import {
  CdlAction,
  CdlFilter,
  Primitive,
  VariableScope,
  VariableValues,
} from './types';
import { isVarRef } from './resolve';

/** Token that resolves to the value emitted by the triggering event. */
const EVENT_TOKEN = '$event';
const HTTP_URL = /^https?:\/\//i;

/**
 * The side-effecting surface an action can touch. Every capability is an
 * explicit method here; there is no escape to arbitrary code. In-app, filter
 * methods dispatch onto dataMask; in the prototype they are injected.
 */
export interface ActionContext {
  vars: VariableValues;
  setVariable: (name: string, value: Primitive) => void;
  applyFilter: (filter: Pick<CdlFilter, 'col' | 'op' | 'val'>) => void;
  crossFilter: (filter: Pick<CdlFilter, 'col' | 'op' | 'val'>) => void;
  clearFilters: (scope?: VariableScope) => void;
  navigateTab: (tabsId: string, tab: string) => void;
  setModalOpen: (modalId: string, open: boolean) => void;
  refresh: (target?: string) => void;
  /** Value from the event that triggered this action list (e.g. Select value). */
  eventValue?: Primitive;
}

function resolveActionValue(value: unknown, ctx: ActionContext): Primitive {
  if (value === EVENT_TOKEN) {
    return ctx.eventValue as Primitive;
  }
  if (isVarRef(value)) {
    return ctx.vars[value.slice(1)];
  }
  return value as Primitive;
}

/** Run an ordered list of declarative actions against the injected context. */
export function runActions(
  actions: CdlAction[] | undefined,
  ctx: ActionContext,
): void {
  (actions ?? []).forEach(action => {
    switch (action.action) {
      case 'setVariable':
        ctx.setVariable(action.name, resolveActionValue(action.value, ctx));
        break;
      case 'applyFilter':
        ctx.applyFilter({
          col: action.col,
          op: action.op,
          val: resolveActionValue(action.val, ctx),
        });
        break;
      case 'crossFilter':
        ctx.crossFilter({
          col: action.col,
          op: action.op,
          val: resolveActionValue(action.val, ctx),
        });
        break;
      case 'clearFilters':
        ctx.clearFilters(action.scope);
        break;
      case 'navigateTab':
        ctx.navigateTab(action.tabsId, action.tab);
        break;
      case 'openModal':
        ctx.setModalOpen(action.modalId, true);
        break;
      case 'closeModal':
        ctx.setModalOpen(action.modalId, false);
        break;
      case 'openUrl':
        if (HTTP_URL.test(action.url)) {
          if (action.newTab) {
            window.open(action.url, '_blank', 'noopener,noreferrer');
          } else {
            window.location.assign(action.url);
          }
        }
        break;
      case 'refresh':
        ctx.refresh(action.target);
        break;
      default:
        break;
    }
  });
}

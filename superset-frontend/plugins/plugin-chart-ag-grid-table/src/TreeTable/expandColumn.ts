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

import { ColDef, SuppressKeyboardEventParams } from 'ag-grid-community';
import ExpandHeader from './ExpandHeader';

export const EXPAND_COLUMN = 'tree_table_expand';

function suppressExpandKeyboardEvent({
  event,
}: SuppressKeyboardEventParams<Record<string, unknown>>) {
  if (
    (event.key !== 'Enter' && event.key !== ' ') ||
    !(event.target instanceof HTMLElement) ||
    event.target.closest('button')
  )
    return false;
  const button = event.target
    .closest('[role="gridcell"]')
    ?.querySelector<HTMLButtonElement>('button');
  if (!button) return false;
  event.preventDefault();
  if (!event.repeat) button.click();
  return true;
}

export const expandColumn: ColDef<Record<string, unknown>> = {
  colId: EXPAND_COLUMN,
  headerName: '',
  width: 48,
  minWidth: 48,
  maxWidth: 48,
  sortable: false,
  suppressHeaderMenuButton: true,
  headerComponentParams: { innerHeaderComponent: ExpandHeader },
  suppressKeyboardEvent: suppressExpandKeyboardEvent,
};

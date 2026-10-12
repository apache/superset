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

import { JSON_CELL_ACTION_SELECTOR, JSON_CELL_OPEN_SELECTOR } from '../consts';

export function isJsonCellActionTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(JSON_CELL_ACTION_SELECTOR) !== null
  );
}

/** Enter on a focused JSON cell opens the dialog. The grid keeps Tab on cells. */
export function openJsonDialogOnEnter(
  nativeEvent: Event | null | undefined,
): boolean {
  if (
    !nativeEvent ||
    !('key' in nativeEvent) ||
    nativeEvent.key !== 'Enter' ||
    ('ctrlKey' in nativeEvent && nativeEvent.ctrlKey) ||
    ('metaKey' in nativeEvent && nativeEvent.metaKey) ||
    ('altKey' in nativeEvent && nativeEvent.altKey)
  ) {
    return false;
  }
  const { target } = nativeEvent;
  // A focused JSON control keeps the browser's own Enter activation.
  if (!(target instanceof Element) || isJsonCellActionTarget(target)) {
    return false;
  }
  const cell = target.closest('.ag-cell') ?? target;
  const open = cell.querySelector(JSON_CELL_OPEN_SELECTOR);
  if (!(open instanceof HTMLElement)) {
    return false;
  }
  nativeEvent.preventDefault();
  open.click();
  return true;
}

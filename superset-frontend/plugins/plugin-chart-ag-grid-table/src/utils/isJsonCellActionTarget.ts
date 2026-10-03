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

import { JSON_CELL_ACTION_SELECTOR, JSON_CELL_SELECTOR } from '../consts';

export function isJsonCellActionTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(JSON_CELL_ACTION_SELECTOR) !== null
  );
}

/** The second click of a double-click on JSON text. It leaves the cross-filter applied by the first click in place. */
export function isJsonCellDoubleClick(
  nativeEvent: Event | null | undefined,
  target: EventTarget | null,
): boolean {
  if (
    !nativeEvent ||
    !('detail' in nativeEvent) ||
    typeof nativeEvent.detail !== 'number' ||
    nativeEvent.detail < 2 ||
    !(target instanceof Element)
  ) {
    return false;
  }
  return target.closest(JSON_CELL_SELECTOR) !== null;
}

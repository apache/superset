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

import { validateNumber } from '@superset-ui/core';

// eslint-disable-next-line import/prefer-default-export
export function parseYAxisBound(
  bound?: string | number | null,
): number | undefined {
  if (bound === undefined || bound === null || Number.isNaN(Number(bound))) {
    return undefined;
  }
  return Number(bound);
}

export function parseNumbersList(value: string, delim = ';') {
  if (!value || !value.trim()) return [];
  return value.split(delim).map(num => {
    if (validateNumber(num)) throw new Error('All values must be numeric');
    return Number(num);
  });
}

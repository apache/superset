/*
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

import { Margin } from './types';

function mergeOneSide(
  operation: (a: number, b: number) => number,
  a = 0,
  b = 0,
) {
  if (Number.isNaN(a) || a === null) return b;
  if (Number.isNaN(b) || b === null) return a;

  return operation(a, b);
}

export default function mergeMargin(
  margin1: Partial<Margin> = {},
  margin2: Partial<Margin> = {},
  mode: 'expand' | 'shrink' = 'expand',
) {
  const { top, left, bottom, right } = margin1;
  const operation = mode === 'expand' ? Math.max : Math.min;

  return {
    bottom: mergeOneSide(operation, bottom, margin2.bottom),
    left: mergeOneSide(operation, left, margin2.left),
    right: mergeOneSide(operation, right, margin2.right),
    top: mergeOneSide(operation, top, margin2.top),
  };
}

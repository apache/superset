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

const HUNDRED_PERCENT = { isDynamic: true, multiplier: 1 } as const;

export default function parseLength(
  input: string | number,
):
  | { isDynamic: true; multiplier: number }
  | { isDynamic: false; value: number } {
  if (input === 'auto' || input === '100%') {
    return HUNDRED_PERCENT;
  }

  if (
    typeof input === 'string' &&
    input.length > 0 &&
    input[input.length - 1] === '%'
  ) {
    return { isDynamic: true, multiplier: parseFloat(input) / 100 };
  }
  const value = typeof input === 'number' ? input : parseFloat(input);

  return { isDynamic: false, value };
}

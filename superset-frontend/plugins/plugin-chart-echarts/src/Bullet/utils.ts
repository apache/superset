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
// Ported from the nvd3 bullet chart so saved comma-separated control values
// keep their exact semantics.
export function tokenizeToNumericArray(value?: string): number[] | null {
  if (!value?.trim()) return null;
  // Lenient by design: this runs on every keystroke, so partial input like
  // "50," must not throw. Empty and non-numeric tokens are dropped.
  const numbers = value
    .split(',')
    .map(token => token.trim())
    .filter(token => token !== '')
    .map(token => Number(token))
    .filter(n => !Number.isNaN(n));
  return numbers.length ? numbers : null;
}

export function tokenizeToStringArray(value?: string): string[] | null {
  if (!value?.trim()) return null;
  return value.split(',').map(token => token.trim());
}

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

// https://en.wikipedia.org/wiki/Linear_congruential_generator
function stringAsciiPRNG(value: string, m: number) {
  // Xn+1 = (a * Xn + c) % m
  // 0 < a < m
  // 0 <= c < m
  // 0 <= X0 < m

  const charCodes = [...value].map(letter => letter.charCodeAt(0));
  const len = charCodes.length;

  const a = (len % (m - 1)) + 1;
  const c = charCodes.reduce((current, next) => current + next) % m;

  let random = charCodes[0] % m;

  [...new Array(len)].forEach(() => {
    random = (a * random + c) % m;
  });

  return random;
}

export function getRandomColor(sampleValue: string, colorList: string[]) {
  // if no value is passed, always return transparent color for consistency
  if (!sampleValue) return 'transparent';

  // value based random color index,
  // ensuring the same sampleValue always resolves to the same color
  return colorList[stringAsciiPRNG(sampleValue, colorList.length)];
}

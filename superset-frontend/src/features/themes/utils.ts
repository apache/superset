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
import { ThemeAlgorithm } from '@apache-superset/core/theme';

const getThemeAlgorithms = (jsonData?: string): string[] => {
  if (!jsonData) return [];

  try {
    const { algorithm } = JSON.parse(jsonData) ?? {};
    if (typeof algorithm === 'string') return [algorithm];
    if (Array.isArray(algorithm))
      return algorithm.filter(alg => typeof alg === 'string');
    return [];
  } catch {
    return [];
  }
};

/**
 * Whether a theme declares an algorithm that contradicts the system slot it is
 * about to fill. Such a theme is still served with the slot's algorithm, so the
 * colors it was authored with will not be the ones users see.
 */
export const hasConflictingAlgorithm = (
  jsonData: string | undefined,
  isDarkSlot: boolean,
): boolean => {
  const algorithms = getThemeAlgorithms(jsonData);
  if (!algorithms.length) return false;

  return algorithms.includes(ThemeAlgorithm.DARK) !== isDarkSlot;
};

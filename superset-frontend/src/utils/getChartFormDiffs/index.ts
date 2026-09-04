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
import { isEqual } from 'lodash';
import { DiffType } from 'src/types/DiffType';
import { JsonObject } from '@superset-ui/core';
import { sanitizeFormData } from '../sanitizeFormData';

export const noisyKeys = new Set(['filters', 'having', 'where']);

export const alterForComparison = (value: unknown): unknown => {
  if (value == null || value === '') return null;
  if (Array.isArray(value) && value.length === 0) return null;
  if (typeof value === 'object' && value && Object.keys(value).length === 0)
    return null;

  return value;
};

export const isEqualish = (a: unknown, b: unknown): boolean =>
  isEqual(alterForComparison(a), alterForComparison(b));

export const getChartFormDiffs = (
  originalFormData: Record<string, unknown>,
  currentFormData: Record<string, unknown>,
): Record<string, DiffType> => {
  const ofd: JsonObject = sanitizeFormData(originalFormData);
  const cfd: JsonObject = sanitizeFormData(currentFormData);

  const keys = new Set([...Object.keys(ofd), ...Object.keys(cfd)]);
  const diffs: Record<string, DiffType> = {};

  keys.forEach((key: string) => {
    if (noisyKeys.has(key)) return;

    const original = ofd[key];
    const current = cfd[key];

    const currentHasKey = Object.prototype.hasOwnProperty.call(cfd, key);
    const originalHasKey = Object.prototype.hasOwnProperty.call(ofd, key);

    const bothExplicit = currentHasKey && originalHasKey;

    if (!bothExplicit && !currentHasKey) return;

    if (!isEqualish(original, current))
      diffs[key] = { before: original, after: current };
  });

  return diffs;
};

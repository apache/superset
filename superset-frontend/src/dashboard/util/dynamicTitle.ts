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
import { ChartCustomization } from '@superset-ui/core';
import uniq from 'lodash/uniq';
import snakeCase from 'lodash/snakeCase';
import { ChartCustomizationPlugins } from 'src/constants';

export type DynamicTitleTokenMappings = Record<string, string>;

export interface DynamicTitleControlValues {
  template?: string;
  tokenMappings?: DynamicTitleTokenMappings;
}

export interface DynamicTitleScopeCandidate {
  id: string;
  chartsInScope: number[];
}

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export const isDynamicTitleCustomization = (
  customization?: Partial<ChartCustomization> | null,
): customization is ChartCustomization =>
  customization?.filterType === ChartCustomizationPlugins.DynamicTitle;

export const getDynamicTitleControlValues = (
  customization?: Partial<ChartCustomization> | null,
): DynamicTitleControlValues =>
  (customization?.controlValues as DynamicTitleControlValues | undefined) || {};

export const extractDynamicTitleAliases = (template?: string): string[] => {
  if (!template) {
    return [];
  }

  const aliases: string[] = [];
  let match = PLACEHOLDER_REGEX.exec(template);
  while (match) {
    aliases.push(match[1]);
    match = PLACEHOLDER_REGEX.exec(template);
  }
  PLACEHOLDER_REGEX.lastIndex = 0;
  return uniq(aliases);
};

export const renderDynamicTitleTemplate = (
  template: string,
  values: Record<string, string | undefined>,
): string =>
  template
    .replace(PLACEHOLDER_REGEX, (_, alias: string) => values[alias] ?? '')
    .replace(/\s+/g, ' ')
    .trim();

export const createDynamicTitleAlias = (
  label: string,
  existingAliases: Iterable<string>,
): string => {
  const usedAliases = new Set(existingAliases);
  const baseAlias = snakeCase(label).replace(/^_+|_+$/g, '') || 'filter';

  let alias = baseAlias;
  let suffix = 2;
  while (usedAliases.has(alias)) {
    alias = `${baseAlias}_${suffix}`;
    suffix += 1;
  }
  return alias;
};

export const findDynamicTitleScopeConflict = (
  candidate: DynamicTitleScopeCandidate,
  existingCandidates: DynamicTitleScopeCandidate[],
): DynamicTitleScopeCandidate | undefined => {
  if (candidate.chartsInScope.length === 0) {
    return undefined;
  }

  const chartsInScope = new Set(candidate.chartsInScope);
  return existingCandidates.find(
    existingCandidate =>
      existingCandidate.id !== candidate.id &&
      existingCandidate.chartsInScope.some(chartId =>
        chartsInScope.has(chartId),
      ),
  );
};

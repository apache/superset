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
import { t } from '@apache-superset/core/translation';
import { ControlState } from '@superset-ui/chart-controls';
import { TreeLevel } from './types';

const linkedToLabel = (parent?: TreeLevel) =>
  parent?.name
    ? t('Linked to %(parent)s by', { parent: parent.name })
    : t('Linked to parent by');

function missingFields(
  level: TreeLevel,
  index: number,
  parent?: TreeLevel,
): string[] {
  const missing: string[] = [];
  if (!level.name?.trim()) missing.push(t('Name'));
  if (!level.id_column) missing.push(t('ID column'));
  if (index > 0 && !level.parent_column) missing.push(linkedToLabel(parent));
  if ((index === 0 || level.apply_date_filter) && !level.time_column) {
    missing.push(t('Time column'));
  }
  return missing;
}

export function validateLevels(levels: TreeLevel[] | null | undefined) {
  if (!levels?.length) return t('Add at least one level.');
  const messages = levels.flatMap((level, index) => {
    const fields = missingFields(level, index, levels[index - 1]);
    const levelMessages = fields.length
      ? [
          t('Level %(number)s is missing: %(fields)s.', {
            number: index + 1,
            fields: fields.join(', '),
          }),
        ]
      : [];
    if (
      index > 0 &&
      level.id_column &&
      level.parent_column === level.id_column
    ) {
      levelMessages.push(
        t("Level %(number)s: %(field)s can't be the level's own ID column.", {
          number: index + 1,
          field: linkedToLabel(levels[index - 1]),
        }),
      );
    }
    if (
      index > 0 &&
      level.apply_date_filter &&
      level.time_column &&
      ![...(level.columns ?? []), ...(level.detail_fields ?? [])].includes(
        level.time_column,
      )
    ) {
      levelMessages.push(
        t(
          'Level %(number)s: with "Apply date filter to children" on, its time column must be one of its Columns or Detail fields.',
          { number: index + 1 },
        ),
      );
    }
    return levelMessages;
  });
  return messages.length ? messages.join(' ') : false;
}

export function validateLevelColumns(
  levels: TreeLevel[] | null | undefined,
  state?: Partial<ControlState>,
) {
  const datasourceColumns = (state?.datasourceColumns as string[]) ?? [];
  if (!datasourceColumns.length) return false;
  const known = new Set(datasourceColumns);
  const missing = new Set<string>();
  (levels ?? []).forEach(level => {
    [
      level.id_column,
      level.parent_column,
      level.time_column,
      ...(level.columns ?? []),
      ...(level.detail_fields ?? []),
    ].forEach(column => {
      if (column && !known.has(column)) missing.add(column);
    });
  });
  return missing.size
    ? t('Not in this dataset: %s.', [...missing].join(', '))
    : false;
}

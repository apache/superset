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
import { Comparator, ObjectFormattingEnum } from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core';

export const operatorOptions = [
  { value: Comparator.None, label: t('None') },
  { value: Comparator.GreaterThan, label: '>' },
  { value: Comparator.LessThan, label: '<' },
  { value: Comparator.GreaterOrEqual, label: '≥' },
  { value: Comparator.LessOrEqual, label: '≤' },
  { value: Comparator.Equal, label: '=' },
  { value: Comparator.NotEqual, label: '≠' },
  { value: Comparator.Between, label: '< x <' },
  { value: Comparator.BetweenOrEqual, label: '≤ x ≤' },
  { value: Comparator.BetweenOrLeftEqual, label: '≤ x <' },
  { value: Comparator.BetweenOrRightEqual, label: '< x ≤' },
];

export const stringOperatorOptions = [
  { value: Comparator.None, label: t('None') },
  { value: Comparator.Equal, label: '=' },
  { value: Comparator.BeginsWith, label: t('begins with') },
  { value: Comparator.EndsWith, label: t('ends with') },
  { value: Comparator.Containing, label: t('containing') },
  { value: Comparator.NotContaining, label: t('not containing') },
];

export const booleanOperatorOptions = [
  { value: Comparator.IsNull, label: t('is null') },
  { value: Comparator.IsTrue, label: t('is true') },
  { value: Comparator.IsFalse, label: t('is false') },
  { value: Comparator.IsNotNull, label: t('is not null') },
];

export const formattingOptions = [
  {
    value: ObjectFormattingEnum.BACKGROUND_COLOR,
    label: t('background color'),
  },
  {
    value: ObjectFormattingEnum.TEXT_COLOR,
    label: t('text color'),
  },
  {
    value: ObjectFormattingEnum.CELL_BAR,
    label: t('cell bar'),
  },
];

// Use theme token names instead of hex values to support theme switching
export const colorSchemeOptions = () => [
  { value: 'colorSuccess', label: t('success') },
  { value: 'colorWarning', label: t('alert') },
  { value: 'colorError', label: t('error') },
];

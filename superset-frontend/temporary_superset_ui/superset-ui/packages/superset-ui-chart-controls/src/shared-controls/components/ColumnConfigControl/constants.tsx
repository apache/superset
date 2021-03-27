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
import React from 'react';
import { GenericDataType, t, validateNumber } from '@superset-ui/core';
import { FaAlignLeft, FaAlignRight, FaAlignCenter } from 'react-icons/fa';
import {
  D3_FORMAT_DOCS,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_DOCS,
  D3_TIME_FORMAT_OPTIONS,
} from '../../../utils';
import { ControlFormItemSpec } from '../../../components/ControlForm';
import { ColumnConfigFormLayout } from './types';

export type SharedColumnConfigProp =
  | 'alignPositiveNegative'
  | 'colorPositiveNegative'
  | 'columnWidth'
  | 'fractionDigits'
  | 'd3NumberFormat'
  | 'd3TimeFormat'
  | 'horizontalAlign'
  | 'showCellBars';

/**
 * All configurable column formatting properties.
 */
export const SHARED_COLUMN_CONFIG_PROPS = {
  d3NumberFormat: {
    controlType: 'Select',
    label: t('D3 format'),
    description: D3_FORMAT_DOCS,
    options: D3_FORMAT_OPTIONS,
    defaultValue: D3_FORMAT_OPTIONS[0][0],
    creatable: true,
    minWidth: '10em',
    debounceDelay: 400,
  } as ControlFormItemSpec<'Select'>,

  d3TimeFormat: {
    controlType: 'Select',
    label: t('D3 format'),
    description: D3_TIME_FORMAT_DOCS,
    options: D3_TIME_FORMAT_OPTIONS,
    defaultValue: D3_TIME_FORMAT_OPTIONS[0][0],
    creatable: true,
    minWidth: '10em',
    debounceDelay: 400,
  } as ControlFormItemSpec<'Select'>,

  fractionDigits: {
    controlType: 'Slider',
    label: t('Fraction digits'),
    description: t('Number of decimal digits to round numbers to'),
    min: 0,
    step: 1,
    max: 100,
    defaultValue: 100,
  } as ControlFormItemSpec<'Slider'>,

  columnWidth: {
    controlType: 'InputNumber',
    label: t('Width'),
    description: t(
      'Default column width in pixels, may still be restricted by the shortest/longest word in the column',
    ),
    width: 120,
    placeholder: 'auto',
    debounceDelay: 400,
    validators: [validateNumber],
  } as ControlFormItemSpec<'InputNumber'>,

  horizontalAlign: {
    controlType: 'RadioButtonControl',
    label: t('Text align'),
    description: t('Horizontal alignment'),
    width: 130,
    debounceDelay: 50,
    defaultValue: 'left',
    options: [
      ['left', <FaAlignLeft title={t('Left')} />],
      ['center', <FaAlignCenter title={t('Center')} />],
      ['right', <FaAlignRight title={t('Right')} />],
    ],
  } as ControlFormItemSpec<'RadioButtonControl'> & {
    value: 'left' | 'right' | 'center';
    defaultValue: 'left' | 'right' | 'center';
  },

  showCellBars: {
    controlType: 'Checkbox',
    label: t('Show cell bars'),
    description: t('Whether to display a bar chart background in table columns'),
    defaultValue: true,
    debounceDelay: 200,
  } as ControlFormItemSpec<'Checkbox'>,

  alignPositiveNegative: {
    controlType: 'Checkbox',
    label: t('Align +/-'),
    description: t('Whether to align positive and negative values in cell bar chart at 0'),
    defaultValue: false,
    debounceDelay: 200,
  } as ControlFormItemSpec<'Checkbox'>,

  colorPositiveNegative: {
    controlType: 'Checkbox',
    label: t('Color +/-'),
    description: t('Whether to colorize numeric values by if they are positive or negative'),
    defaultValue: false,
    debounceDelay: 200,
  } as ControlFormItemSpec<'Checkbox'>,
};

export type SharedColumnConfig = {
  [key in SharedColumnConfigProp]?: typeof SHARED_COLUMN_CONFIG_PROPS[key]['value'];
};

export const DEFAULT_CONFIG_FORM_LAYOUT: ColumnConfigFormLayout = {
  [GenericDataType.STRING]: [
    ['columnWidth', { name: 'horizontalAlign', override: { defaultValue: 'left' } }],
  ],
  [GenericDataType.NUMERIC]: [
    ['columnWidth', { name: 'horizontalAlign', override: { defaultValue: 'right' } }],
    ['d3NumberFormat'],
    ['fractionDigits'],
    ['alignPositiveNegative', 'colorPositiveNegative'],
    ['showCellBars'],
  ],
  [GenericDataType.TEMPORAL]: [
    ['columnWidth', { name: 'horizontalAlign', override: { defaultValue: 'left' } }],
    ['d3TimeFormat'],
  ],
  [GenericDataType.BOOLEAN]: [
    ['columnWidth', { name: 'horizontalAlign', override: { defaultValue: 'left' } }],
  ],
};

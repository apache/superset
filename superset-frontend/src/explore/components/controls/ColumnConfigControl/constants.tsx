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
import {
  ControlFormItemSpec,
  D3_FORMAT_DOCS,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_DOCS,
  D3_TIME_FORMAT_OPTIONS,
} from '@superset-ui/chart-controls';
import Icons from 'src/components/Icons';
import { ColumnConfigFormLayout } from './types';

export type SharedColumnConfigProp =
  | 'alignPositiveNegative'
  | 'colorPositiveNegative'
  | 'columnWidth'
  | 'fractionDigits'
  | 'd3NumberFormat'
  | 'd3SmallNumberFormat'
  | 'd3TimeFormat'
  | 'horizontalAlign'
  | 'truncateLongCells'
  | 'showCellBars'
  | 'currencyFormat';

const d3NumberFormat: ControlFormItemSpec<'Select'> = {
  allowNewOptions: true,
  controlType: 'Select',
  label: t('D3 format'),
  description: D3_FORMAT_DOCS,
  options: D3_FORMAT_OPTIONS.map(option => ({
    value: option[0],
    label: option[1],
  })),
  defaultValue: D3_FORMAT_OPTIONS[0][0],
  creatable: true,
  minWidth: '14em',
  debounceDelay: 500,
};

const d3TimeFormat: ControlFormItemSpec<'Select'> = {
  controlType: 'Select',
  label: t('D3 format'),
  description: D3_TIME_FORMAT_DOCS,
  options: D3_TIME_FORMAT_OPTIONS.map(option => ({
    value: option[0],
    label: option[1],
  })),
  defaultValue: D3_TIME_FORMAT_OPTIONS[0][0],
  creatable: true,
  minWidth: '10em',
  debounceDelay: 500,
};

const fractionDigits: ControlFormItemSpec<'Slider'> = {
  controlType: 'Slider',
  label: t('Fraction digits'),
  description: t('Number of decimal digits to round numbers to'),
  min: 0,
  step: 1,
  max: 100,
  defaultValue: 100,
};

const columnWidth: ControlFormItemSpec<'InputNumber'> = {
  controlType: 'InputNumber',
  label: t('Min Width'),
  description: t(
    "Default minimal column width in pixels, actual width may still be larger than this if other columns don't need much space",
  ),
  width: 120,
  placeholder: t('auto'),
  debounceDelay: 400,
  validators: [validateNumber],
};

const horizontalAlign: ControlFormItemSpec<'RadioButtonControl'> & {
  value?: 'left' | 'right' | 'center';
  defaultValue?: 'left' | 'right' | 'center';
} = {
  controlType: 'RadioButtonControl',
  label: t('Text align'),
  description: t('Horizontal alignment'),
  width: 130,
  debounceDelay: 50,
  defaultValue: 'left',
  options: [
    ['left', <Icons.AlignLeftOutlined iconSize="m" />],
    ['center', <Icons.AlignCenterOutlined iconSize="m" />],
    ['right', <Icons.AlignRightOutlined iconSize="m" />],
  ],
};

const showCellBars: ControlFormItemSpec<'Checkbox'> = {
  controlType: 'Checkbox',
  label: t('Show cell bars'),
  description: t('Whether to display a bar chart background in table columns'),
  defaultValue: true,
  debounceDelay: 200,
};

const alignPositiveNegative: ControlFormItemSpec<'Checkbox'> = {
  controlType: 'Checkbox',
  label: t('Align +/-'),
  description: t(
    'Whether to align positive and negative values in cell bar chart at 0',
  ),
  defaultValue: false,
  debounceDelay: 200,
};

const colorPositiveNegative: ControlFormItemSpec<'Checkbox'> = {
  controlType: 'Checkbox',
  label: t('Color +/-'),
  description: t(
    'Whether to colorize numeric values by if they are positive or negative',
  ),
  defaultValue: false,
  debounceDelay: 200,
};

const truncateLongCells: ControlFormItemSpec<'Checkbox'> = {
  controlType: 'Checkbox',
  label: t('Truncate Cells'),
  description: t('Truncate long cells to the "min width" set above'),
  defaultValue: false,
  debounceDelay: 400,
};

const currencyFormat: ControlFormItemSpec<'CurrencyControl'> = {
  controlType: 'CurrencyControl',
  label: t('Currency format'),
  description: t(
    'Customize chart metrics or columns with currency symbols as prefixes or suffixes. Choose a symbol from dropdown or type your own.',
  ),
  debounceDelay: 200,
};
/**
 * All configurable column formatting properties.
 */
export const SHARED_COLUMN_CONFIG_PROPS = {
  d3NumberFormat,
  d3SmallNumberFormat: {
    ...d3NumberFormat,
    label: t('Small number format'),
    description: t(
      'D3 number format for numbers between -1.0 and 1.0, ' +
        'useful when you want to have different significant digits for small and large numbers',
    ),
  },
  d3TimeFormat,
  fractionDigits,
  columnWidth,
  truncateLongCells,
  horizontalAlign,
  showCellBars,
  alignPositiveNegative,
  colorPositiveNegative,
  currencyFormat,
};

export const DEFAULT_CONFIG_FORM_LAYOUT: ColumnConfigFormLayout = {
  [GenericDataType.STRING]: [
    [
      'columnWidth',
      { name: 'horizontalAlign', override: { defaultValue: 'left' } },
    ],
    ['truncateLongCells'],
  ],
  [GenericDataType.NUMERIC]: [
    {
      tab: t('Display'),
      children: [
        [
          'columnWidth',
          { name: 'horizontalAlign', override: { defaultValue: 'right' } },
        ],
        ['showCellBars'],
        ['alignPositiveNegative'],
        ['colorPositiveNegative'],
      ],
    },
    {
      tab: t('Number formatting'),
      children: [
        ['d3NumberFormat'],
        ['d3SmallNumberFormat'],
        ['currencyFormat'],
      ],
    },
  ],
  [GenericDataType.TEMPORAL]: [
    [
      'columnWidth',
      { name: 'horizontalAlign', override: { defaultValue: 'left' } },
    ],
    ['d3TimeFormat'],
  ],
  [GenericDataType.BOOLEAN]: [
    [
      'columnWidth',
      { name: 'horizontalAlign', override: { defaultValue: 'left' } },
    ],
  ],
};

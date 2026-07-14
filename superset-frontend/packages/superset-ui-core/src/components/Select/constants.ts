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
import {
  LabeledValue as AntdLabeledValue,
  SelectProps as AntdSelectProps,
} from 'antd/es/select';
import { t } from '@apache-superset/core/translation';
import { rankedSearchCompare } from '../../utils/rankedSearchCompare';
import { RawValue } from './types';

export const MAX_TAG_COUNT = 4;

const PLACEMENT_SHARED_CONFIG = {
  overflow: { adjustX: false, adjustY: true, shiftY: true },
  htmlRegion: 'visible' as const,
  dynamicInset: true,
};

/**
 * antd 6's default Select popup placements with horizontal viewport
 * adjustment disabled, preserving the dropdown-positioning fix from
 * #36963. antd 6 removed the `dropdownAlign` prop that fix was expressed
 * through; `builtinPlacements` is its supported replacement, but it
 * replaces the entire placement map, so all four entries are provided
 * (mirroring antd's own defaults except for `adjustX`).
 */
export const DROPDOWN_BUILTIN_PLACEMENTS: AntdSelectProps['builtinPlacements'] =
  {
    bottomLeft: {
      ...PLACEMENT_SHARED_CONFIG,
      points: ['tl', 'bl'],
      offset: [0, 4],
    },
    bottomRight: {
      ...PLACEMENT_SHARED_CONFIG,
      points: ['tr', 'br'],
      offset: [0, 4],
    },
    topLeft: {
      ...PLACEMENT_SHARED_CONFIG,
      points: ['bl', 'tl'],
      offset: [0, -4],
    },
    topRight: {
      ...PLACEMENT_SHARED_CONFIG,
      points: ['br', 'tr'],
      offset: [0, -4],
    },
  };

export const TOKEN_SEPARATORS = [',', '\r\n', '\n', '\t', ';'];

export const EMPTY_OPTIONS = [];

export const DEFAULT_PAGE_SIZE = 100;

export const SELECT_ALL_VALUE: RawValue = t('Select All');

export const VIRTUAL_THRESHOLD = 20;

export const SELECT_ALL_OPTION = {
  value: SELECT_ALL_VALUE,
  label: String(SELECT_ALL_VALUE),
};

export const DEFAULT_SORT_COMPARATOR = (
  a: AntdLabeledValue,
  b: AntdLabeledValue,
  search?: string,
) => {
  let aText: string | undefined;
  let bText: string | undefined;
  if (typeof a.label === 'string' && typeof b.label === 'string') {
    aText = a.label;
    bText = b.label;
  } else if (typeof a.value === 'string' && typeof b.value === 'string') {
    aText = a.value;
    bText = b.value;
  }
  // sort selected options first
  if (typeof aText === 'string' && typeof bText === 'string') {
    if (search) {
      return rankedSearchCompare(aText, bText, search);
    }
    return aText.localeCompare(bText);
  }
  return (a.value as number) - (b.value as number);
};

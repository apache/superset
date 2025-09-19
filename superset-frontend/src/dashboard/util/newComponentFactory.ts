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
import { nanoid } from 'nanoid';
import { t } from '@superset-ui/core';

import {
  CHART_TYPE,
  COLUMN_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
  DYNAMIC_TYPE,
} from './componentTypes';

import {
  MEDIUM_HEADER,
  BACKGROUND_TRANSPARENT,
  GRID_DEFAULT_CHART_WIDTH,
  GRID_COLUMN_COUNT,
} from './constants';

import type { ComponentType, LayoutItem } from '../types';

// Define interfaces for different component metadata types
interface ChartMeta {
  width: number;
  height: number;
}

interface ColumnMeta {
  width: number;
  background: string;
}

interface HeaderMeta {
  text: string;
  headerSize: string;
  background: string;
}

interface MarkdownMeta {
  width: number;
  height: number;
}

interface RowMeta {
  background: string;
}

interface TabMeta {
  text: string;
  defaultText: string;
  placeholder: string;
}

interface DynamicMeta {
  width: number;
  background: string;
}

// Union type for all possible meta types
type ComponentMeta =
  | ChartMeta
  | ColumnMeta
  | HeaderMeta
  | MarkdownMeta
  | RowMeta
  | TabMeta
  | DynamicMeta
  | Record<string, unknown>
  | null;

// Type mapping for component types to their default metadata
type DefaultMetaDataMap = {
  [CHART_TYPE]: ChartMeta;
  [COLUMN_TYPE]: ColumnMeta;
  [DIVIDER_TYPE]: null;
  [HEADER_TYPE]: HeaderMeta;
  [MARKDOWN_TYPE]: MarkdownMeta;
  [ROW_TYPE]: RowMeta;
  [TABS_TYPE]: null;
  [TAB_TYPE]: TabMeta;
  [DYNAMIC_TYPE]: DynamicMeta;
};

const typeToDefaultMetaData: DefaultMetaDataMap = {
  [CHART_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [COLUMN_TYPE]: {
    width: GRID_DEFAULT_CHART_WIDTH,
    background: BACKGROUND_TRANSPARENT,
  },
  [DIVIDER_TYPE]: null,
  [HEADER_TYPE]: {
    text: t('New header'),
    headerSize: MEDIUM_HEADER,
    background: BACKGROUND_TRANSPARENT,
  },
  [MARKDOWN_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [ROW_TYPE]: { background: BACKGROUND_TRANSPARENT },
  [TABS_TYPE]: null,
  [TAB_TYPE]: {
    text: '',
    defaultText: t('Tab title'),
    placeholder: t('Tab title'),
  },
  [DYNAMIC_TYPE]: {
    width: GRID_COLUMN_COUNT,
    background: BACKGROUND_TRANSPARENT,
  },
};

function uuid(type: ComponentType): string {
  return `${type}-${nanoid()}`;
}

function entityFactory(
  type: ComponentType,
  meta?: Partial<ComponentMeta>,
  parents: string[] = [],
): LayoutItem {
  return {
    type,
    id: uuid(type),
    children: [],
    parents,
    meta: {
      ...(typeToDefaultMetaData[type as keyof DefaultMetaDataMap] || {}),
      ...meta,
    } as LayoutItem['meta'],
  };
}

export default entityFactory;

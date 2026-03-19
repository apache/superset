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
  ColorFormatters,
  getTextColorForBackground,
  ObjectFormattingEnum,
} from '@superset-ui/chart-controls';
import { CellClassParams } from '@superset-ui/core/components/ThemedAgGridReact';
import { BasicColorFormatterType, InputColumn } from '../types';

type CellStyleParams = CellClassParams & {
  hasColumnColorFormatters: boolean | undefined;
  columnColorFormatters: ColorFormatters;
  hasBasicColorFormatters: boolean | undefined;
  basicColorFormatters?: {
    [Key: string]: BasicColorFormatterType;
  }[];
  col: InputColumn;
  cellSurfaceColor: string;
  hoverCellSurfaceColor: string;
};

const getCellStyle = (params: CellStyleParams) => {
  const {
    value,
    colDef,
    rowIndex,
    hasBasicColorFormatters,
    basicColorFormatters,
    hasColumnColorFormatters,
    columnColorFormatters,
    col,
    node,
    cellSurfaceColor,
    hoverCellSurfaceColor,
  } = params;
  let backgroundColor;
  let color;
  if (hasColumnColorFormatters) {
    columnColorFormatters!
      .filter(formatter => {
        const colTitle = formatter?.column?.includes('Main')
          ? formatter?.column?.replace('Main', '').trim()
          : formatter?.column;
        return colTitle === colDef.field;
      })
      .forEach(formatter => {
        const formatterResult =
          value || value === 0 ? formatter.getColorFromValue(value) : false;
        if (formatterResult) {
          if (
            formatter.objectFormatting === ObjectFormattingEnum.TEXT_COLOR ||
            formatter.toTextColor
          ) {
            color = formatterResult;
          } else if (
            formatter.objectFormatting !== ObjectFormattingEnum.CELL_BAR
          ) {
            backgroundColor = formatterResult;
          }
        }
      });
  }

  if (
    hasBasicColorFormatters &&
    col?.metricName &&
    node?.rowPinned !== 'bottom'
  ) {
    backgroundColor =
      basicColorFormatters?.[rowIndex]?.[col.metricName]?.backgroundColor;
  }

  const textAlign =
    col?.config?.horizontalAlign || (col?.isNumeric ? 'right' : 'left');
  const resolvedTextColor = getTextColorForBackground(
    { backgroundColor, color },
    cellSurfaceColor,
  );
  const hoverResolvedTextColor = getTextColorForBackground(
    { backgroundColor, color },
    hoverCellSurfaceColor,
  );

  return {
    backgroundColor: backgroundColor || '',
    color: resolvedTextColor ? 'var(--ag-cell-value-color)' : '',
    '--ag-cell-value-color': resolvedTextColor || '',
    '--ag-cell-value-hover-color': hoverResolvedTextColor || '',
    textAlign,
  };
};

export default getCellStyle;

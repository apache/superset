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
import getRowBasicColorFormatter from './getRowBasicColorFormatter';

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
    const applyFormatter = (
      formatter: ColorFormatters[number],
      valueToFormat: typeof value,
    ) => {
      const formatterResult =
        valueToFormat || valueToFormat === 0
          ? formatter.getColorFromValue(valueToFormat)
          : false;
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
    };

    // formatter.column can be a legacy display label ("Main colname") for
    // time-comparison columns rather than the row's actual data key, so
    // resolve it to the real field id before using it to read row values.
    const resolveColumnKey = (columnKey: string) =>
      columnKey.includes('Main')
        ? columnKey.replace('Main', '').trim()
        : columnKey;

    columnColorFormatters!
      .filter(formatter => {
        if (formatter.columnFormatting) {
          return formatter.columnFormatting === colDef.field;
        }
        return resolveColumnKey(formatter.column) === colDef.field;
      })
      .forEach(formatter => {
        const valueToFormat = formatter.columnFormatting
          ? node?.data?.[resolveColumnKey(formatter.column)]
          : value;
        applyFormatter(formatter, valueToFormat);
      });

    // Entire-row formatters apply to every cell in the row, keyed off the
    // value in the formatter's own column rather than this cell's column.
    columnColorFormatters!
      .filter(
        formatter =>
          formatter.columnFormatting === ObjectFormattingEnum.ENTIRE_ROW,
      )
      .forEach(formatter =>
        applyFormatter(
          formatter,
          node?.data?.[resolveColumnKey(formatter.column)],
        ),
      );
  }

  if (
    hasBasicColorFormatters &&
    col?.metricName &&
    node?.rowPinned !== 'bottom'
  ) {
    const basicBackgroundColor = getRowBasicColorFormatter(
      node,
      rowIndex,
      basicColorFormatters,
    )?.[col.metricName]?.backgroundColor;
    // Only override when this column actually has an increase/decrease
    // formatter. Green/Red conditional-format rules only target some metrics,
    // so a column carrying only a standard conditional-format rule would
    // otherwise have its background clobbered with `undefined` when Green/Red
    // rules exist on other columns.
    if (basicBackgroundColor) {
      backgroundColor = basicBackgroundColor;
    }
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
    color: '',
    '--ag-cell-value-color': resolvedTextColor || '',
    '--ag-cell-value-hover-color': hoverResolvedTextColor || '',
    textAlign,
  };
};

export default getCellStyle;

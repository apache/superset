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
  DataRecordValue,
  GenericDataType,
  NumberFormats,
  TimeFormatter,
  ValueFormatter,
} from '@superset-ui/core';
import { isNumber } from 'lodash';
import { getPercentFormatter } from './formatters';

export type Column = {
  type: GenericDataType;
  formatter: ValueFormatter | TimeFormatter | StringConstructor;
};

export type Data = {
  columns: [Column, Column];
  rows: [string, DataRecordValue][];
};

export default class TooltipRenderer {
  static COLUMN_PADDING = 16;

  data;

  focusedRow;

  percentageFormatter;

  showPercentage;

  showTotal;

  title;

  total;

  constructor(
    data: Data,
    focusedRow: number,
    showPercentage: boolean,
    showTotal: boolean,
    title?: string,
    percentageFormatter = getPercentFormatter(NumberFormats.PERCENT_2_POINT),
  ) {
    this.data = data;
    this.focusedRow = focusedRow;
    this.percentageFormatter = percentageFormatter;
    this.showPercentage = showPercentage;
    this.showTotal = showTotal;
    this.title = title;
    this.total = this.calculateTotal();
  }

  calculateTotal() {
    const { rows } = this.data;
    return rows.reduce(
      (acc, row) => (isNumber(row[1]) ? acc + row[1] : acc),
      0,
    );
  }

  renderCell(value: DataRecordValue, column: Column, padding: number) {
    const columnStyle = `
      text-align: ${column.type === GenericDataType.Numeric ? 'right' : 'left'};
      padding-left: ${padding}px;`;
    const formattedValue: string = column.formatter(value as any);
    return `<td style="${columnStyle}">${formattedValue}</td>`;
  }

  renderPercentageCell(value: DataRecordValue, padding: number) {
    return this.renderCell(
      (value as number) / (this.total || 1),
      {
        type: GenericDataType.Numeric,
        formatter: this.percentageFormatter,
      },
      padding,
    );
  }

  renderRows() {
    const { columns, rows } = this.data;
    return rows.map((row, i) => {
      const rowStyle =
        i === this.focusedRow ? 'font-weight: 700;' : 'opacity: 0.7;';
      let padding = 0;
      const cells = row.map((value, j) => {
        const column = columns[j];
        const cell = this.renderCell(value, column, padding);
        padding = TooltipRenderer.COLUMN_PADDING;
        return cell;
      });
      if (this.showPercentage && columns[1].type === GenericDataType.Numeric) {
        cells.push(this.renderPercentageCell(row[1], padding));
      }
      return `<tr style="${rowStyle}">${cells.join('')}</tr>`;
    });
  }

  renderTotalRow() {
    const { columns } = this.data;
    return `
      <tr>
        ${this.renderCell('Total', columns[0], 0)}
        ${this.renderCell(
          this.total,
          columns[1],
          TooltipRenderer.COLUMN_PADDING,
        )}
        ${
          this.showPercentage
            ? this.renderPercentageCell(
                this.total,
                TooltipRenderer.COLUMN_PADDING,
              )
            : ''
        }
      </tr>`;
  }

  renderHtml() {
    const { columns } = this.data;
    const title = this.title
      ? `<tr><td colspan="${columns.length}" style="font-weight: 700;">${this.title}</td></tr>`
      : '';
    const totalRow =
      this.showTotal && columns[1].type === GenericDataType.Numeric
        ? this.renderTotalRow()
        : '';
    return `<table>${title}${this.renderRows().join('')}${totalRow}</table>`;
  }
}

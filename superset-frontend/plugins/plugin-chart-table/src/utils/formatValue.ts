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
  CurrencyFormatter,
  DataRecordValue,
  getNumberFormatter,
  isProbablyHTML,
  sanitizeHtml,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { DataColumnMeta } from '../types';
import DateWithFormatter from './DateWithFormatter';

/**
 * Returns true if the given D3 format string represents a percentage format.
 * Percentage values are stored as decimals (e.g. 0.05 = 5%), so
 * Math.abs(value) < 1 is always true for them. Without this guard the
 * small-number formatter would intercept every value in a percentage column
 * and render it without the intended percentage formatting.
 * See https://github.com/apache/superset/issues/36189
 */
function isPercentageFormat(formatString?: string): boolean {
  return typeof formatString === 'string' && formatString.trim().endsWith('%');
}

/**
 * Format text for cell value.
 */
function formatValue(
  formatter: DataColumnMeta['formatter'],
  value: DataRecordValue,
  rowData?: Record<string, DataRecordValue>,
  currencyColumn?: string,
): [boolean, string] {
  // render undefined as empty string
  if (value === undefined) {
    return [false, ''];
  }
  // render null as N/A
  if (
    value === null ||
    (value instanceof DateWithFormatter && value.input === null)
  ) {
    return [false, 'N/A'];
  }
  if (formatter) {
    if (formatter instanceof CurrencyFormatter) {
      return [false, formatter(value as number, rowData, currencyColumn)];
    }
    return [false, formatter(value as number)];
  }
  if (typeof value === 'string') {
    return isProbablyHTML(value) ? [true, sanitizeHtml(value)] : [false, value];
  }
  return [false, value.toString()];
}

export function formatColumnValue(
  column: DataColumnMeta,
  value: DataRecordValue,
  rowData?: Record<string, DataRecordValue>,
) {
  const { dataType, formatter, config = {}, currencyCodeColumn } = column;
  const isNumber = dataType === GenericDataType.Numeric;
  const smallNumberFormatter =
    config.d3SmallNumberFormat === undefined
      ? formatter
      : config.currencyFormat
        ? new CurrencyFormatter({
            d3Format: config.d3SmallNumberFormat,
            currency: config.currencyFormat,
          })
        : getNumberFormatter(config.d3SmallNumberFormat);

  // Do not apply the small-number formatter when the column uses a percentage
  // format. Percentage values are stored as decimals (0-1), so the threshold
  // Math.abs(value) < 1 would fire for every value and bypass the intended
  // percentage formatter. See https://github.com/apache/superset/issues/36189
  const useSmallNumberFormatter =
    isNumber &&
    typeof value === 'number' &&
    Math.abs(value) < 1 &&
    !isPercentageFormat(config.d3NumberFormat);

  return formatValue(
    useSmallNumberFormatter ? smallNumberFormatter : formatter,
    value,
    rowData,
    currencyCodeColumn,
  );
}

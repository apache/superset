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
import { logging } from '@superset-ui/core';

export interface NumericCellProps {
  /**
   * The number to display (before optional formatting applied)
   */
  value: number;
  /**
   * ISO 639-1 language code with optional region or script modifier (e.g. en_US).
   */
  locale?: string;
  /**
   * Options for number formatting
   */
  options?: NumberOptions;
}

interface NumberOptions {
  /**
   * Style of number to display
   */
  style?: Style;

  /**
   * ISO 4217 currency code
   */
  currency?: string;

  /**
   * Languages in the form of a ISO 639-1 language code with optional region or script modifier (e.g. de_AT).
   */
  maximumFractionDigits?: number;

  /**
   * A number from 1 to 21 (default is 21)
   */
  maximumSignificantDigits?: number;

  /**
   * A number from 0 to 20 (default is 3)
   */
  minimumFractionDigits?: number;

  /**
   * A number from 1 to 21 (default is 1)
   */
  minimumIntegerDigits?: number;

  /**
   * A number from 1 to 21 (default is 21)
   */
  minimumSignificantDigits?: number;
}

export enum Style {
  Currency = 'currency',
  Decimal = 'decimal',
  Percent = 'percent',
}

export enum CurrencyDisplay {
  Symbol = 'symbol',
  Code = 'code',
  Name = 'name',
}

export function NumericCell(props: NumericCellProps) {
  const { value, locale = 'en_US', options } = props;
  let displayValue = value?.toString() ?? value;
  try {
    displayValue = value?.toLocaleString?.(locale, options);
  } catch (e) {
    logging.error(e);
  }

  return <span>{displayValue}</span>;
}

export default NumericCell;

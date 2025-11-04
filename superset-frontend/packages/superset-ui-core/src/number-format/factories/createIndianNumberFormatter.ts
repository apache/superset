/*
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
  format as d3Format,
  formatLocale,
  FormatLocaleDefinition,
} from 'd3-format';
import NumberFormatter from '../NumberFormatter';

export default function createIndianNumberFormatter(
  config: {
    description?: string;
    signed?: boolean;
    id?: string;
    label?: string;
    locale?: FormatLocaleDefinition;
  } = {},
) {
  const { description, signed = false, id, label, locale } = config;

  const local = locale ? formatLocale(locale) : null;
  const fmt = (spec: string) => (local ? local.format(spec) : d3Format(spec));

  const formatAbbrev = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 100) return fmt(',d')(value);
    if (abs >= 10) return fmt(',.1~f')(value);
    return fmt(',.2~f')(value);
  };

  const formatValue = (value: number) => {
    if (value === 0) return '0';
    const abs = Math.abs(value);
    if (abs >= 10000000) {
      const inCr = value / 10000000;
      return `${formatAbbrev(inCr)}CR`;
    }
    if (abs >= 100000) {
      const inLakh = value / 100000;
      return `${formatAbbrev(inLakh)}L`;
    }
    if (abs >= 1) {
      return fmt(',.2~f')(value);
    }
    if (abs >= 0.001) {
      return fmt('.4~f')(value);
    }
    return d3Format('.3~s')(value);
  };

  const getSign = signed ? (value: number) => (value > 0 ? '+' : '') : () => '';

  return new NumberFormatter({
    description,
    formatFunc: value => `${getSign(value)}${formatValue(value)}`,
    id: id ?? (signed ? 'SMART_NUMBER_IN_SIGNED' : 'SMART_NUMBER_IN'),
    label:
      label ?? (signed ? 'Adaptive (Indian, signed)' : 'Adaptive (Indian)'),
  });
}

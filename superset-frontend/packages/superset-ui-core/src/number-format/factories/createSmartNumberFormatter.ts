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

import { formatLocale } from 'd3-format';
import NumberFormatter from '../NumberFormatter';
import NumberFormats from '../NumberFormats';
import { DEFAULT_D3_FORMAT } from '../D3FormatConfig';

const locale = formatLocale(DEFAULT_D3_FORMAT);
const siFormatter = locale.format(`.3~s`);
const float2PointFormatter = locale.format(`.2~f`);
const float4PointFormatter = locale.format(`.4~f`);

function formatValue(value: number | bigint) {
  const numValue = typeof value === 'bigint' ? Number(value) : value;
  if (numValue === 0) {
    return '0';
  }
  const absoluteValue = Math.abs(numValue);
  if (absoluteValue >= 1000) {
    // Normal human being are more familiar
    // with billion (B) that giga (G)
    return siFormatter(numValue).replace('G', 'B');
  }
  if (absoluteValue >= 1) {
    return float2PointFormatter(numValue);
  }
  if (absoluteValue >= 0.001) {
    return float4PointFormatter(numValue);
  }
  if (absoluteValue > 0.000001) {
    return `${siFormatter(numValue * 1000000)}µ`;
  }
  return siFormatter(numValue);
}

export default function createSmartNumberFormatter(
  config: {
    description?: string;
    signed?: boolean;
    id?: string;
    label?: string;
  } = {},
) {
  const { description, signed = false, id, label } = config;
  const getSign = signed
    ? (value: number | bigint) => (value > 0 ? '+' : '')
    : () => '';

  return new NumberFormatter({
    description,
    formatFunc: value => `${getSign(value)}${formatValue(value)}`,
    id:
      id ??
      (signed ? NumberFormats.SMART_NUMBER_SIGNED : NumberFormats.SMART_NUMBER),
    label: label ?? 'Adaptive formatter',
  });
}

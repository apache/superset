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

import NumberFormatter from '../NumberFormatter';
import { NumberFormatFunction } from '../types';

const BITS_PER_BYTE = 8;
const BASE = 1000;
const SUFFIXES = [
  'bps',
  'kbps',
  'Mbps',
  'Gbps',
  'Tbps',
  'Pbps',
  'Ebps',
  'Zbps',
  'Ybps',
  'Rbps',
  'Qbps',
];

function formatThroughput(
  decimals: number,
  fromBytes: boolean,
): NumberFormatFunction {
  return value => {
    if (value === 0) {
      return `0${SUFFIXES[0]}`;
    }

    const sign = value > 0 ? '' : '-';
    const magnitude = Math.abs(value);
    const bits = fromBytes ? magnitude * BITS_PER_BYTE : magnitude;
    let i = Math.max(
      0,
      Math.min(
        SUFFIXES.length - 1,
        Math.floor(Math.log(bits) / Math.log(BASE)),
      ),
    );
    let scaled = parseFloat((bits / Math.pow(BASE, i)).toFixed(decimals));

    if (scaled >= BASE && i < SUFFIXES.length - 1) {
      i += 1;
      scaled = parseFloat((bits / Math.pow(BASE, i)).toFixed(decimals));
    }

    return `${sign}${scaled}${SUFFIXES[i]}`;
  };
}

export default function createThroughputFormatter(
  config: {
    description?: string;
    id?: string;
    label?: string;
    decimals?: number;
    fromBytes?: boolean;
  } = {},
) {
  const { description, id, label, decimals = 2, fromBytes = false } = config;

  return new NumberFormatter({
    description,
    formatFunc: formatThroughput(decimals, fromBytes),
    id: id ?? 'throughput_format',
    label: label ?? `Throughput formatter`,
  });
}

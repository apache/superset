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

function formatMemory(
  binary?: boolean,
  decimals?: number,
  transfer?: boolean,
): NumberFormatFunction {
  return value => {
    let formatted = '';
    if (value === 0) {
      formatted = '0B';
    } else {
      const sign = value > 0 ? '' : '-';
      const absValue = Math.abs(value);

      const suffixes = binary
        ? ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
        : ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB', 'RB', 'QB'];
      const base = binary ? 1024 : 1000;

      const i = Math.min(
        suffixes.length - 1,
        Math.floor(Math.log(absValue) / Math.log(base)),
      );
      formatted = `${sign}${parseFloat((absValue / Math.pow(base, i)).toFixed(decimals))}${suffixes[i]}`;
    }

    if (transfer) {
      formatted = `${formatted}/s`;
    }
    return formatted;
  };
}

export default function createMemoryFormatter(
  config: {
    description?: string;
    id?: string;
    label?: string;
    binary?: boolean;
    decimals?: number;
    transfer?: boolean;
  } = {},
) {
  const {
    description,
    id,
    label,
    binary,
    decimals = 2,
    transfer = false,
  } = config;

  return new NumberFormatter({
    description,
    formatFunc: formatMemory(binary, decimals, transfer),
    id: id ?? 'memory_format',
    label: label ?? `Memory formatter`,
  });
}

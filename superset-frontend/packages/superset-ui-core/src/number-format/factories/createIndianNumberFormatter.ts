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

// import { format as d3Format } from 'd3-format';
import NumberFormatter from '../NumberFormatter';

// const float2PointFormatter = d3Format(`.2~f`);
const indianLocaleFormatter = Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
}).format; // d3Format or regex whould be alternative

function formatIndianUnitNumber(
  value: number,
  { refoldAfterCrs = false },
): string {
  let formated_number = 0;
  const sufix = [];
  let local_value = value;
  do {
    if (local_value >= 10000000) {
      formated_number = local_value / 10000000;
      sufix.unshift('Cr');
    } else if (local_value >= 100000) {
      formated_number = local_value / 100000;
      sufix.unshift('L');
    } else if (local_value >= 1000) {
      formated_number = local_value / 1000;
      sufix.unshift('K');
    } else {
      formated_number = local_value;
    }
    local_value = formated_number;
  } while (refoldAfterCrs && local_value >= 1000);

  return indianLocaleFormatter(local_value) + sufix.join(' ');
}

function formatIndianNumber(value: number): string {
  return indianLocaleFormatter(value);
}

export default function createIndianNumberFormatter(
  config: {
    prefix?: string;
    foldToUnit?: boolean;
    refoldAfterCrs?: boolean;
    id?: string;
    label?: string;
    description?: string;
  } = {
    prefix: '',
    foldToUnit: false,
    refoldAfterCrs: false,
  },
) {
  const { prefix, foldToUnit, refoldAfterCrs, id, label, description } = config;

  return new NumberFormatter({
    description: description || 'Indian Number Formatter',
    formatFunc: value => {
      const sign = value >= 0 ? '' : '-';
      const formattedNumber = foldToUnit
        ? formatIndianUnitNumber(Math.abs(value), { refoldAfterCrs })
        : formatIndianNumber(Math.abs(value));
      return sign + prefix + formattedNumber;
    },
    id: id || 'indian_nunber_formatter',
    label: label || 'Indian Number Formatter',
  });
}

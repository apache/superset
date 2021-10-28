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

import { format as d3Format } from 'd3-format';
import NumberFormatter from '../NumberFormatter';

export default function createSiAtMostNDigitFormatter(
  config: {
    description?: string;
    n?: number;
    id?: string;
    label?: string;
  } = {},
) {
  const { description, n = 3, id, label } = config;
  const siFormatter = d3Format(`.${n}s`);

  return new NumberFormatter({
    description,
    formatFunc: value => {
      const si = siFormatter(value);

      /* Removing trailing `.00` if any */
      return si.slice(-1) < 'A' ? parseFloat(si).toString() : si;
    },
    id: id ?? `si_at_most_${n}_digit`,
    label: label ?? `SI with at most ${n} significant digits`,
  });
}

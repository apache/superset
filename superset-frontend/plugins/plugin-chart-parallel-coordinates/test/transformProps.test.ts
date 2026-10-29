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

import { ChartProps } from '@superset-ui/core';
import transformProps from '../src/transformProps';

const createProps = () =>
  ({
    width: 800,
    height: 600,
    formData: {
      includeSeries: false,
      linearColorScheme: 'superset_seq_1',
      metrics: undefined,
      secondaryMetric: 'sum__SP_POP_TOTL',
      series: 'country_name',
      showDatatable: false,
    },
    queriesData: [{ data: [{ country_id: 'FRA', metric: 10 }] }],
    theme: {},
  }) as unknown as ChartProps;

test('do not crash on undefined metrics', () => {
  expect(() => transformProps(createProps())).not.toThrow();
});

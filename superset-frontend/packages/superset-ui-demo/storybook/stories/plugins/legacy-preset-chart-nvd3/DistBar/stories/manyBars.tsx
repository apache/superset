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

import { SuperChart, seedRandom } from '@superset-ui/core';
import dummyDatasource from '../../../../../shared/dummyDatasource';

const data: {
  key: string;
  values: {
    x: string;
    y: number;
  }[];
}[] = [{ key: 'sth', values: [] }];
const LONG_LABEL =
  'some extremely ridiculously extremely extremely extremely ridiculously extremely extremely ridiculously extremely extremely ridiculously extremely long category';

for (let i = 0; i < 50; i += 1) {
  data[0].values.push({
    x: `${LONG_LABEL.substring(
      0,
      Math.round(seedRandom() * LONG_LABEL.length),
    )} ${i + 1}`,
    y: Math.round(seedRandom() * 10000),
  });
}

export const manyBars = () => (
  <SuperChart
    chartType="dist-bar"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'd3Category10',
      showBarValue: false,
      showLegend: true,
      vizType: 'dist_bar',
      xTicksLayout: 'auto',
    }}
  />
);

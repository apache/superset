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

import { ChartProps, supersetTheme } from '@superset-ui/core';
import transformProps from '../../src/legacyPlugin/transformProps';

describe('WordCloud transformProps', () => {
  const formData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    rotation: 'square',
    series: 'name',
    sizeFrom: 10,
    sizeTo: 70,
  };
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [{ name: 'Hulk', sum__num: 1 }],
      },
    ],
    theme: supersetTheme,
  });

  it('should transform chart props for word cloud viz', () => {
    expect(transformProps(chartProps)).toEqual({
      width: 800,
      height: 600,
      encoding: {
        color: {
          field: 'name',
          scale: {
            scheme: 'bnbColors',
          },
          type: 'nominal',
        },
        fontSize: {
          field: 'sum__num',
          scale: {
            range: [10, 70],
            zero: true,
          },
          type: 'quantitative',
        },
        text: {
          field: 'name',
        },
      },
      rotation: 'square',
      data: [{ name: 'Hulk', sum__num: 1 }],
    });
  });
});

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

import { ChartLayer } from '../../src/components/ChartLayer';
import { ChartLayerOptions } from '../../src/types';

describe('ChartLayer', () => {
  it('creates div and loading mask', () => {
    const options: ChartLayerOptions = {
      chartVizType: 'pie',
    };
    const chartLayer = new ChartLayer(options);

    expect(chartLayer.loadingMask).toBeDefined();
    expect(chartLayer.div).toBeDefined();
  });

  it('can remove chart elements', () => {
    const options: ChartLayerOptions = {
      chartVizType: 'pie',
    };
    const chartLayer = new ChartLayer(options);
    chartLayer.charts = [
      {
        htmlElement: document.createElement('div'),
      },
    ];

    chartLayer.removeAllChartElements();
    expect(chartLayer.charts).toEqual([]);
  });
});

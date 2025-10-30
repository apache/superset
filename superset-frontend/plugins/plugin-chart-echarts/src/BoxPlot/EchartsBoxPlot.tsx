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
import Echart from '../components/Echart';
import { allEventHandlers } from '../utils/eventHandlers';
import { BoxPlotChartTransformedProps } from './types';

export default function EchartsBoxPlot(props: BoxPlotChartTransformedProps) {
  const { height, width, echartOptions, selectedValues, refs, formData } =
    props;

  const eventHandlers = allEventHandlers(props);
  if (formData.showRangeFilter) {
    echartOptions.dataZoom = [
      {
        show: true,
        type: 'slider',
        left: '0rem', // Adjust the left position as needed
        yAxisIndex: [0],
        width: '20rem', // Adjust the width as needed
        filterMode: 'filter',
        labelFormatter: () => '', // Hide labels on the data zoom slider
      },
    ];
  }

  return (
    <Echart
      refs={refs}
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      selectedValues={selectedValues}
    />
  );
}

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
import { HistogramTransformedProps } from './types';
import Echart from '../components/Echart';
import { EventHandlers } from '../types';

export default function Histogram(props: HistogramTransformedProps) {
  const {
    height,
    width,
    echartOptions,
    onFocusedSeries,
    onLegendStateChanged,
    refs,
  } = props;

  // Log the echartOptions to the console
  console.log('Current echartOptions:', echartOptions);

  // Modify echartOptions to add annotations
  // const updatedEchartOptions = {
  //   ...echartOptions,
  //   series: (echartOptions.series as any[]).map((seriesItem: any) => ({
  //     ...seriesItem,
  //     markLine: {
  //       data: [
  //         // { type: 'average', name: 'Average' },
  //         // { yAxis: 4200, name: 'horizontal Line at 4200' },
  //         { xAxis: "1488 - 2975", name: 'title' },
  //       //   [
  //       //     {
  //       //         name: 'Mark line between two points',
  //       //         x: 500,
  //       //         y: 250
  //       //     },
  //       //     {
  //       //         x: 500,
  //       //         y: 100
  //       //     }
  //       // ],
  //     //   [{
  //     //     // Mark line with a fixed X position in starting point. This is used to generate an arrow pointing to maximum line.
  //     //     yAxis: 'max',
  //     //     x: '90%'
  //     // }, {
  //     //     type: 'max'
  //     // }],
  //     // { xAxis: 560 },
  //       ],
  //       label: {
  //         show: true,
  //         position: 'end',
  //         formatter: '{b}',
  //         color: 'red',
  //         fontSize: 12,
  //       },
  //     },
  //     // markPoint: {
  //     //   data: [
  //     //     { type: 'max', name: 'Max' },
  //     //     { type: 'min', name: 'Min' },
  //     //   ],
  //     // },
  //     // markArea: {
  //     //   data: [
  //     //     [
  //     //       { name: 'Area 1', xAxis: 'A' },
  //     //       { xAxis: 'B' },
  //     //     ],
  //     //   ],
  //     // },
  //   })),
  // };

  const eventHandlers: EventHandlers = {
    legendselectchanged: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendselectall: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendinverseselect: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    mouseout: () => {
      onFocusedSeries(undefined);
    },
    mouseover: params => {
      onFocusedSeries(params.seriesIndex);
    },
  };

  return (
    <Echart
      refs={refs}
      height={height}
      width={width}
      echartOptions={echartOptions} // Pass the updated echartOptions here
      eventHandlers={eventHandlers}
    />
  );
}

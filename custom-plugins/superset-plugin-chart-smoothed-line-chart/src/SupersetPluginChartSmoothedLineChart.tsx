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
import React, { createRef, useEffect } from 'react';
import { styled } from '@superset-ui/core';
import { SupersetPluginChartSmoothedLineChartStylesProps } from './types';
import * as echarts from 'echarts';

/*const Styles = styled.div`
  height: ${({ height }: { height: number }) => height}px;
  width: ${({ width }: { width: number }) => width}px;
`;*/
const Styles = styled.div<SupersetPluginChartSmoothedLineChartStylesProps>`
  background-color: ${({ theme }) => theme.colors.secondary.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
`;



export default function SupersetPluginChartMyHelloWorld(props: SupersetPluginChartSmoothedLineChartStylesProps) {
  const { height, width } = props;
  const rootElem = createRef<HTMLDivElement>();

  useEffect(() => {
    const root = rootElem.current;
    const chart = echarts.init(root as HTMLDivElement);
    const option = {
      xAxis: {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        //data: data.map(row => row.__timestamp),
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          //data: data.map(row => row.metric),
          data: [820, 932, 901, 934, 1290, 1330, 1320],
          type: 'line',
          smooth: true,
        },
      ],
    };

    chart.setOption(option);

    return () => chart.dispose();
  });

  return <Styles ref={rootElem} height={height} width={width} />;
}

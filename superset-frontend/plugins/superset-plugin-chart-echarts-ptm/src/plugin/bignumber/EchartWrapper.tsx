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
import { useRef, useEffect } from 'react';
import { styled } from '@superset-ui/core';
import { use, init, EChartsType } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import {
  TooltipComponent,
  GridComponent,
  AriaComponent,
} from 'echarts/components';
import type { EChartsCoreOption } from 'echarts/core';

use([
  CanvasRenderer,
  LineChart,
  TooltipComponent,
  GridComponent,
  AriaComponent,
]);

interface EchartWrapperProps {
  width: number;
  height: number;
  echartOptions: EChartsCoreOption;
  eventHandlers?: Record<string, any>;
  refs?: Record<string, any>;
}

const Styles = styled.div<{ height: number; width: number }>`
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
`;

export default function EchartWrapper({
  width,
  height,
  echartOptions,
  eventHandlers,
  refs,
}: EchartWrapperProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType>();

  if (refs) {
    refs.divRef = divRef;
  }

  useEffect(() => {
    if (!divRef.current) return;
    
    if (!chartRef.current) {
      chartRef.current = init(divRef.current);
    }

    chartRef.current.resize({ width, height });
  }, [width, height]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (eventHandlers) {
      Object.entries(eventHandlers).forEach(([name, handler]) => {
        chartRef.current?.off(name);
        chartRef.current?.on(name, handler);
      });
    }

    chartRef.current.setOption(echartOptions, true);
  }, [echartOptions, eventHandlers]);

  useEffect(
    () => () => {
      chartRef.current?.dispose();
    },
    [],
  );

  return <Styles ref={divRef} height={height} width={width} />;
}


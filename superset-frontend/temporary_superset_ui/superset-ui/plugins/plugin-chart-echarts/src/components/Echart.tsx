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
import React, { useRef, useEffect } from 'react';
import { styled } from '@superset-ui/core';
import { ECharts, init } from 'echarts';
import { EchartsProps, EchartsStylesProps } from '../types';

const Styles = styled.div<EchartsStylesProps>`
  height: ${({ height }) => height};
  width: ${({ width }) => width};
`;

export default function Echart({
  width,
  height,
  echartOptions,
  eventHandlers,
  selectedValues = {},
}: EchartsProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts>();
  const currentSelection = Object.keys(selectedValues) || [];
  const previousSelection = useRef<string[]>([]);

  useEffect(() => {
    if (!divRef.current) return;
    if (!chartRef.current) {
      chartRef.current = init(divRef.current);
    }

    Object.entries(eventHandlers || {}).forEach(([name, handler]) => {
      chartRef.current?.off(name);
      chartRef.current?.on(name, handler);
    });

    chartRef.current.setOption(echartOptions, true);

    chartRef.current.dispatchAction({
      type: 'downplay',
      dataIndex: previousSelection.current.filter(value => !currentSelection.includes(value)),
    });
    if (currentSelection.length) {
      chartRef.current.dispatchAction({
        type: 'highlight',
        dataIndex: currentSelection,
      });
    }
    previousSelection.current = currentSelection;
  }, [echartOptions, eventHandlers, selectedValues]);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.resize({ width, height });
    }
  }, [width, height]);

  return <Styles ref={divRef} height={height} width={width} />;
}

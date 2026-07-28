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
import { useEffect, useRef, type JSX } from 'react';
import type { EChartsOption } from 'echarts';
import { echarts, type EChartsType } from '../echarts';

export interface EChartHandlers {
  onDataPointClick?: (params: EChartClickParams) => void;
  onBrushEnd?: (range: { startIndex: number; endIndex: number }) => void;
}

export interface EChartClickParams {
  seriesName: string;
  seriesId?: string;
  name: string;
  dataIndex: number;
  value: unknown;
}

interface Props extends EChartHandlers {
  option: EChartsOption;
  scheme: 'light' | 'dark';
  enableBrush?: boolean;
}

/**
 * A thin React wrapper over an ECharts instance. Uses `notMerge: false` +
 * stable series ids so universal transitions animate view morphs, and wires
 * click + brush interactions for drill-down.
 */
export function EChart({
  option,
  scheme,
  enableBrush,
  onDataPointClick,
  onBrushEnd,
}: Props): JSX.Element {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const handlersRef = useRef<EChartHandlers>({});
  handlersRef.current = { onDataPointClick, onBrushEnd };

  // Create / dispose the instance and keep it responsive to container size.
  useEffect(() => {
    if (!elRef.current) return undefined;
    const chart = echarts.init(elRef.current, undefined, { renderer: 'canvas' });
    chartRef.current = chart;

    chart.on('click', (params: unknown) => {
      const p = params as {
        seriesName?: string;
        seriesId?: string;
        name?: string;
        dataIndex?: number;
        value?: unknown;
      };
      if (p && typeof p.dataIndex === 'number') {
        handlersRef.current.onDataPointClick?.({
          seriesName: p.seriesName ?? '',
          seriesId: p.seriesId,
          name: p.name ?? '',
          dataIndex: p.dataIndex,
          value: p.value,
        });
      }
    });

    chart.on('brushEnd', (params: unknown) => {
      const areas = (params as { areas?: Array<{ coordRange?: [number, number] }> })?.areas;
      const range = areas?.[0]?.coordRange;
      if (range && range.length === 2) {
        handlersRef.current.onBrushEnd?.({
          startIndex: Math.round(range[0]),
          endIndex: Math.round(range[1]),
        });
        // Clear the brush overlay after capture.
        chart.dispatchAction({ type: 'brush', areas: [] });
      }
    });

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(elRef.current);

    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // Apply option updates (transitions handled by ECharts via stable ids).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, { notMerge: false, lazyUpdate: true });
  }, [option, scheme]);

  // Toggle brush selection tool for time-series drill.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (enableBrush) {
      chart.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'brush',
        brushOption: { brushType: 'lineX', brushMode: 'single' },
      });
    } else {
      chart.dispatchAction({ type: 'takeGlobalCursor', key: 'brush', brushOption: false });
    }
  }, [enableBrush, option]);

  return <div className="sv-echart" ref={elRef} />;
}

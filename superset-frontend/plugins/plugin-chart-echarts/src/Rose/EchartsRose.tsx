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
import { useMemo, useState } from 'react';
import {
  CategoricalColorNamespace,
  getNumberFormatter,
  sanitizeHtml,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import type { EChartsCoreOption } from 'echarts/core';
import Echart from '../components/Echart';
import { allEventHandlers } from '../utils/eventHandlers';
import { RoseChartTransformedProps } from './types';

/**
 * Renders the polar rose, and drills a clicked time period into a full
 * pie of that period's series (morphing via universalTransition), like
 * the legacy chart's click-to-expand interaction. Clicking again
 * returns to the rose.
 */
export default function EchartsRose(props: RoseChartTransformedProps) {
  const {
    height,
    width,
    echartOptions,
    refs,
    formData,
    periods,
    seriesNames,
    numberFormat,
    sliceId,
    colorScheme,
  } = props;
  const theme = useTheme();
  const [drillIndex, setDrillIndex] = useState<number | null>(null);

  const activeOptions = useMemo((): EChartsCoreOption => {
    const period = drillIndex !== null ? periods[drillIndex] : undefined;
    if (!period) {
      return echartOptions;
    }
    const colorFn = CategoricalColorNamespace.getScale(colorScheme);
    // getScale returns a fresh scale whose colors assign in first-call
    // order; prime it in series order so slice colors match the rose view.
    seriesNames.forEach(name => colorFn(name, sliceId));
    const format = getNumberFormatter(numberFormat);
    // The legacy pie ordered slices largest-first
    const slices = [...period.entries].sort((a, b) => b.value - a.value);
    return {
      legend: echartOptions.legend,
      title: {
        text: t('%s — click the chart to return', period.label),
        left: 'center',
        bottom: 0,
        textStyle: {
          color: theme.colorTextSecondary,
          fontSize: theme.fontSizeSM,
          fontWeight: 'normal',
        },
      },
      tooltip: {
        confine: true,
        formatter: (params: { name: string; value: number; percent: number }) =>
          `<div><b>${period.label}</b></div>${sanitizeHtml(params.name)}: ${format(
            params.value,
          )} (${params.percent}%)`,
      },
      series: [
        {
          id: 'rose-pie',
          type: 'pie',
          radius: ['7.5%', '72%'],
          center: ['50%', '54%'],
          // hide labels of slivers, like the legacy 5% label threshold
          minShowLabelAngle: 18,
          universalTransition: { enabled: true },
          label: { color: theme.colorText },
          itemStyle: {
            borderColor: theme.colorBgContainer,
            borderWidth: 1,
          },
          data: slices.map(entry => ({
            name: entry.seriesName,
            value: entry.value,
            groupId: entry.seriesName,
            itemStyle: { color: colorFn(entry.seriesName, sliceId) },
          })),
        },
      ],
    };
  }, [
    drillIndex,
    periods,
    seriesNames,
    echartOptions,
    colorScheme,
    numberFormat,
    sliceId,
    theme,
  ]);

  const eventHandlers = {
    ...allEventHandlers(props),
    click: (params: { dataIndex?: number }) => {
      setDrillIndex(current =>
        current === null ? (params.dataIndex ?? null) : null,
      );
    },
  };

  return (
    <Echart
      refs={refs}
      height={height}
      width={width}
      echartOptions={activeOptions}
      eventHandlers={eventHandlers}
      vizType={formData.vizType}
    />
  );
}

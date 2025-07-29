/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useState, useMemo, useRef, type RefObject } from 'react';
import {
  Behavior,
  DataRecord,
  t,
  CategoricalColorNamespace,
  NumberFormats,
  getNumberFormatter,
  useTheme,
  SetQueryObjectFilterClause,
} from '@superset-ui/core';

import Echart from '../../plugin-chart-echarts/src/components/Echart';
import { BarChartTransformedProps } from './types';
import type { EchartsHandler } from '@superset-ui/plugin-chart-echarts/src/types';

// Helper function to aggregate data for the current drilldown level
const getChartData = (
  sourceData: DataRecord[],
  currentLevelColumn: string,
  metric: string,
) => {
  const groupedData = new Map<string, number>();
  sourceData.forEach(row => {
    const key = String(row[currentLevelColumn] || t('N/A'));
    const value = (groupedData.get(key) || 0) + (row[metric] as number);
    groupedData.set(key, value);
  });

  return Array.from(groupedData.entries()).map(([name, value]) => ({
    name,
    value,
  }));
};

export default function DrilldownBarChart(props: BarChartTransformedProps) {
  const {
    height,
    width,
    echartOptions,
    drilldownData,
    formData,
    refs,
    hooks,
    behaviors,
  } = props;

  const theme = useTheme();
  const { colorScheme, showLabels, labelRotation } = formData;
  const { hierarchy, sourceData, metric } = drilldownData;
  const [drilldownPath, setDrilldownPath] = useState<string[]>([]);

  const numberFormatter = getNumberFormatter(NumberFormats.SMART_NUMBER);

  const currentChartOptions = useMemo(() => {
    const currentLevel = drilldownPath.length;

    // Filter data based on current drilldown path
    const filteredData =
      currentLevel > 0
        ? sourceData.filter(row =>
            drilldownPath.every(
              (pathItem, i) => String(row[hierarchy[i]]) === pathItem,
            ),
          )
        : sourceData;

    // Group by current level and sum metric
    const chartData = getChartData(
      filteredData,
      hierarchy[currentLevel],
      metric,
    );

    const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

    return {
      ...echartOptions,
      xAxis: {
        type: 'category',
        data: chartData.map(item => item.name),
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          type: 'bar',
          data: chartData.map(item => ({
            value: item.value,
            name: item.name,
            itemStyle: {
              color: colorFn(item.name),
            },
          })),
          // label: {
          //   show: true,
          //   formatter: (params: any) =>
          //     `${params.name}: ${numberFormatter(params.value)}`,
          // },
          label: {
            show: showLabels,
            rotate: labelRotation,
            formatter: ({ value }: any) => numberFormatter(value),
          },

          emphasis: {
            focus: 'series',
          },
          stack: undefined,
        },
      ],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          return params
            .map(
              p =>
                `${p.name}: ${numberFormatter(p.value)} (${p.percent ?? 0}%)`,
            )
            .join('<br />');
        },
      },
    };
  }, [
    drilldownPath,
    sourceData,
    hierarchy,
    metric,
    echartOptions,
    colorScheme,
    numberFormatter,
  ]);

  const handleBreadcrumbClick = (index: number) => {
    const newPath = drilldownPath.slice(0, index);
    setDrilldownPath(newPath);

    if (behaviors?.includes(Behavior.InteractiveChart)) {
      if (index === 0) {
        hooks?.setDataMask?.({ extraFormData: {}, filterState: {} });
      } else {
        const filters: SetQueryObjectFilterClause[] = newPath.map(
          (value, i) => ({
            col: drilldownData.hierarchy[i],
            op: 'IN',
            val: [value],
          }),
        );

        hooks?.setDataMask?.({
          extraFormData: { filters },
          filterState: {
            value: newPath,
          },
        });
      }
    }
  };

  const eventHandlers = {
    click: (params: any) => {
      const selectedValue = params.name;

      const filters: SetQueryObjectFilterClause[] = drilldownPath.map(
        (value, i) => ({
          col: drilldownData.hierarchy[i],
          op: 'IN',
          val: [value],
        }),
      );

      const nextLevel = drilldownPath.length;
      if (drilldownData.hierarchy[nextLevel]) {
        filters.push({
          col: drilldownData.hierarchy[nextLevel],
          op: 'IN',
          val: [selectedValue],
        });
      }

      if (behaviors?.includes(Behavior.InteractiveChart)) {
        hooks?.setDataMask?.({
          extraFormData: { filters },
          filterState: {
            value: [...drilldownPath, selectedValue],
          },
        });
      }

      if (
        drilldownData.hierarchy.length > 1 &&
        drilldownPath.length < drilldownData.hierarchy.length - 1
      ) {
        setDrilldownPath([...drilldownPath, selectedValue]);
      }
    },
  };

  const fallbackRef = useRef<EchartsHandler>(null);
  const isValidEchartRef =
    refs &&
    'current' in refs &&
    typeof refs.current === 'object' &&
    refs.current !== null &&
    'getEchartInstance' in refs.current;

  const echartRef = isValidEchartRef
    ? (refs as unknown as RefObject<EchartsHandler>)
    : fallbackRef;

  const safeRefObject = { echartRef };

  const Breadcrumbs = () => (
    <div
      style={{
        position: 'absolute',
        top: 30,
        left: 15,
        zIndex: 999,
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#333',
      }}
    >
      <span
        onClick={() => handleBreadcrumbClick(0)}
        style={{
          cursor: 'pointer',
          color: theme.colors.primary.base,
          textDecoration: 'underline',
        }}
        role="button"
        tabIndex={0}
      >
        {t('All')}
      </span>
      {drilldownPath.map((pathItem, i) => (
        <span key={pathItem}>
          {' > '}
          <span
            onClick={() => handleBreadcrumbClick(i + 1)}
            style={{
              cursor: 'pointer',
              color: theme.colors.primary.base,
              textDecoration: 'underline',
            }}
            role="button"
            tabIndex={0}
          >
            {pathItem}
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div style={{ position: 'relative', height, width }}>
      <Breadcrumbs />
      <Echart
        refs={safeRefObject}
        height={height}
        width={width}
        echartOptions={currentChartOptions}
        eventHandlers={eventHandlers}
        selectedValues={{}}
      />
    </div>
  );
}

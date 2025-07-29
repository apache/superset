/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useState, useMemo, type RefObject } from 'react';
import {
  Behavior,
  DataRecord,
  t,
  CategoricalColorNamespace,
  NumberFormats,
  getNumberFormatter,
  useTheme, // 1. Import the useTheme hook
  SetQueryObjectFilterClause,
} from '@superset-ui/core';
// import Echart from '../components/Echart';
import Echart from '../../plugin-chart-echarts/src/components/Echart';

import { PieChartTransformedProps } from './types';

import { useRef } from 'react';
import type { EchartsHandler } from '../../plugin-chart-echarts/src/types';

// Helper function to aggregate data for the current drilldown level.
// It groups the data by the current hierarchy column and sums the metric.
const getChartData = (
  sourceData: DataRecord[],
  currentLevelColumn: string,
  metric: string,
) => {
  const groupedData = new Map<string, number>();
  sourceData.forEach(row => {
    // Use the raw column name for grouping
    const key = String(row[currentLevelColumn] || t('N/A'));
    const value = (groupedData.get(key) || 0) + (row[metric] as number);
    groupedData.set(key, value);
  });

  return Array.from(groupedData.entries()).map(([name, value]) => ({
    name,
    value,
  }));
};

export default function DrilldownPieChart(props: PieChartTransformedProps) {
  // Destructure all needed props, including our new drilldownData
  const {
    height,
    width,
    echartOptions,
    drilldownData,
    formData,
    refs,
    hooks,
    behaviors,
  } = props; // 2. Remove theme from props destructuring
  const theme = useTheme(); // 3. Get the theme object using the hook
  const { colorScheme } = formData;
  const { hierarchy, sourceData, metric } = drilldownData;

  // State to manage the current path of the drilldown, e.g., ['North America', 'USA']
  const [drilldownPath, setDrilldownPath] = useState<string[]>([]);

  const numberFormatter = getNumberFormatter(NumberFormats.SMART_NUMBER);

  // Memoize the chart options to avoid re-calculating on every render
  const currentChartOptions = useMemo(() => {
    const currentLevel = drilldownPath.length;

    // Filter the source data based on the current drilldown path
    const filteredData =
      currentLevel > 0
        ? sourceData.filter(row =>
            drilldownPath.every(
              (pathItem, i) => String(row[hierarchy[i]]) === pathItem,
            ),
          )
        : sourceData;

    // Get the data for the current pie chart view
    const chartData = getChartData(
      filteredData,
      hierarchy[currentLevel], // The column for the current drilldown level
      metric,
    );

    const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

    // Get the original series object to retain base styles
    const originalSeries = Array.isArray(echartOptions.series)
      ? echartOptions.series[0]
      : {};

    return {
      ...echartOptions,
      series: [
        {
          ...originalSeries,
          data: chartData.map(item => ({
            ...item,
            itemStyle: {
              color: colorFn(item.name),
            },
          })),
        },
      ],
      // Override tooltip to ensure it works with our dynamic data
      tooltip: {
        // Add a fallback empty object to prevent a crash if tooltip is null/undefined
        ...(echartOptions.tooltip || {}),
        formatter: (params: any) =>
          `${params.name}: ${numberFormatter(params.value)} (${
            params.percent
          }%)`,
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

  // // Handler for when a user clicks a pie slice
  // const onChartClick = useCallback(
  //   (params: { name: string }) => {
  //     // Only drill down if there are more levels in the hierarchy
  //     if (drilldownPath.length < hierarchy.length - 1) {
  //       setDrilldownPath([...drilldownPath, params.name]);
  //     }
  //   },
  //   [drilldownPath, hierarchy],
  // );

  // // Handler for when a user clicks a breadcrumb to go back up
  // const handleBreadcrumbClick = (index: number) => {
  //   setDrilldownPath(drilldownPath.slice(0, index));
  // };
  const handleBreadcrumbClick = (index: number) => {
    const newPath = drilldownPath.slice(0, index);
    setDrilldownPath(newPath);

    if (behaviors?.includes(Behavior.InteractiveChart)) {
      if (index === 0) {
        // Clear filters completely
        hooks?.setDataMask?.({
          extraFormData: {},
          filterState: {},
        });
      } else {
        // Rebuild filter list for each level up to the clicked breadcrumb
        const filters: SetQueryObjectFilterClause[] = newPath.map(
          (value, i) => ({
            col: drilldownData?.hierarchy?.[i]!,
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

  // Define our own event handlers object, replacing the original one.
  const eventHandlers = {
    click: (params: any) => {
      const selectedValue = params.name;

      // Reconstruct filters from full drilldown path
      const filters: SetQueryObjectFilterClause[] = drilldownPath.map(
        (value, i) => ({
          col: drilldownData?.hierarchy?.[i]!,
          op: 'IN',
          val: [value],
        }),
      );

      // Add filter for current click level
      const nextLevel = drilldownPath.length;
      if (drilldownData?.hierarchy?.[nextLevel]) {
        filters.push({
          col: drilldownData.hierarchy[nextLevel],
          op: 'IN',
          val: [selectedValue],
        });
      }

      // Cross-filtering
      if (behaviors?.includes(Behavior.InteractiveChart)) {
        hooks?.setDataMask?.({
          extraFormData: { filters },
          filterState: {
            value: [...drilldownPath, selectedValue],
          },
        });
      }

      // Drill-down state update
      if (
        drilldownData?.hierarchy?.length > 1 &&
        drilldownPath.length < drilldownData.hierarchy.length - 1
      ) {
        setDrilldownPath([...drilldownPath, selectedValue]);
      }
    },
  };

  const fallbackRef = useRef<EchartsHandler>(null);

  // Use `refs` only if it's already a valid EchartsHandler ref
  const echartRef =
    refs && 'current' in refs && 'getEchartInstance' in (refs.current ?? {})
      ? (refs as unknown as RefObject<EchartsHandler>)
      : fallbackRef;

  const safeRefObject = { echartRef };

  // Breadcrumb navigation component, absolutely positioned over the chart
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
          // The theme object is now reliably available here
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
              // The theme object is now reliably available here
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
        refs={safeRefObject} // ← always a valid object, never undefined
        height={height}
        width={width}
        echartOptions={currentChartOptions}
        eventHandlers={eventHandlers}
        selectedValues={{}}
      />
    </div>
  );
}

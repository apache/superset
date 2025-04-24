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
import { EChartsCoreOption } from 'echarts/core';
import { useTheme } from '@superset-ui/core';
import React, { useRef } from 'react';
import Echart from '../components/Echart';
import { WaterfallChartTransformedProps } from './types';
import { EventHandlers } from '../types';

export default function EchartsWaterfall(
  props: WaterfallChartTransformedProps,
) {
  const {
    height,
    width,
    echartOptions,
    setDataMask,
    onContextMenu,
    refs,
    onLegendStateChanged,
    formData: {
      sortXAxis,
      orientation,
      showTotal,
      useFirstValueAsSubtotal,
      totalColor,
      xAxisLabelDistance,
      yAxisLabelDistance,
      boldTotal,
      boldSubTotal,
    },
    emitCrossFilters,
  } = props;

  const theme = useTheme();
  const chartRef = useRef<any>(null);

  const eventHandlers: EventHandlers = {
    click: params => {
      if (!setDataMask || !emitCrossFilters) return;

      const { name: value } = params;
      const xAxisColumn = props.formData.xAxis;

      // Don't filter on Total column
      if (value === 'Total') return;

      const isCurrentValue = props.filterState?.value === value;

      if (isCurrentValue) {
        // Clear the filter and visual state
        setDataMask({
          extraFormData: {},
          filterState: {
            value: null,
          },
        });

        if (chartRef.current) {
          const series = echartOptions.series as any[];
          const updatedSeries = series.map(s => ({
            ...s,
            itemStyle: {
              ...s.itemStyle,
              opacity: 1,
            },
          }));

          if (orientation === 'vertical') {
            chartRef.current.getEchartInstance().setOption({
              series: updatedSeries,
            });
          } else {
            chartRef.current.getEchartInstance().setOption({
              series: updatedSeries.map(s => ({
                ...s,
                data: [...s.data].reverse(),
              })),
            });
          }
        }
        return;
      }

      // Set new filter
      setDataMask({
        extraFormData: {
          filters: [
            {
              col: xAxisColumn,
              op: '==',
              val: value,
            },
          ],
        },
        filterState: {
          value,
        },
      });

      if (chartRef.current) {
        const series = echartOptions.series as any[];
        const xAxisLabel = echartOptions.xAxis as { data: (string | number)[] };
        // get index of value in xAxisLabel
        const valueIndex = (xAxisLabel?.data || []).indexOf(value);

        const updatedSeries = series.map(s => ({
          ...s,
          data: s.data.map((d: any, idx: number) => ({
            ...d,
            itemStyle: {
              ...d.itemStyle,
              opacity: !Number.isNaN(d.value) && idx === valueIndex ? 1 : 0.3,
            },
          })),
        }));

        if (orientation === 'vertical') {
          chartRef.current.getEchartInstance().setOption({
            series: updatedSeries,
          });
        } else {
          chartRef.current.getEchartInstance().setOption({
            series: updatedSeries.map(s => ({
              ...s,
              data: [...s.data].reverse(),
            })),
          });
        }
      }
    },
    contextmenu: params => {
      if (onContextMenu) {
        onContextMenu(params.name, 0);
      }
    },
    legendselectchanged: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendselectall: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendinverseselect: payload => {
      onLegendStateChanged?.(payload.selected);
    },
  };

  const getSubtotalOptions = (options: EChartsCoreOption) => {
    if (!useFirstValueAsSubtotal) return options;

    const xAxisData = [
      ...((options.xAxis as { data: (string | number)[] }).data || []),
    ];

    const processedSeries = ((options.series as any[]) || []).map(series => {
      const newData = series.data.map((dataPoint: any, index: number) => {
        if (index !== 0) return dataPoint;

        const isTransparent =
          dataPoint?.itemStyle?.color &&
          dataPoint.itemStyle.color === 'transparent';

        if (isTransparent) return dataPoint;

        if (dataPoint.value === '-') return dataPoint;

        const updatedColor = `rgba(${totalColor.r}, ${totalColor.g}, ${totalColor.b}, ${totalColor.a})`;
        return {
          ...dataPoint,
          itemStyle: {
            ...dataPoint.itemStyle,
            color: updatedColor,
            borderColor: updatedColor,
          },
        };
      });

      return {
        ...series,
        data: newData,
      };
    });

    return {
      ...options,
      xAxis: {
        ...(options.xAxis as any),
        data: xAxisData,
      },
      series: processedSeries,
    };
  };

  const getShowTotalOptions = (options: EChartsCoreOption) => {
    if (showTotal) return options;

    const totalsIndex =
      ((options.series as any[]) || [])
        .find(series => series.name === 'Total')
        ?.data.map((dataPoint: any, index: number) =>
          dataPoint.value !== '-' ? index : -1,
        )
        .filter((index: number) => index !== -1) || [];

    const xAxisData = [
      ...((options.xAxis as { data: (string | number)[] }).data || []),
    ].filter((_, index) => !totalsIndex.includes(index));

    const filteredSeries = ((options.series as any[]) || []).map(series => ({
      ...series,
      data: series.data.filter(
        (_: any, index: number) => !totalsIndex.includes(index),
      ),
    }));

    return {
      ...options,
      xAxis: {
        ...(options.xAxis as any),
        data: xAxisData,
      },
      series: filteredSeries,
    };
  };

  const getSortedOptions = (options: EChartsCoreOption) => {
    if (sortXAxis === 'none') return options;
    const xAxisData = [
      ...((options.xAxis as { data: (string | number)[] }).data || []),
    ];

    const sortedData = [...xAxisData];

    sortedData.sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') {
        return sortXAxis === 'asc' ? a - b : b - a;
      }
      const aStr = String(a);
      const bStr = String(b);
      return sortXAxis === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    const indexMap = new Map(xAxisData.map((val, index) => [val, index]));

    const sortedSeries = ((options.series as any[]) || []).map(series => ({
      ...series,
      data: sortedData.map(value => {
        const index = indexMap.get(value);
        return index !== undefined ? (series as any).data[index] : null;
      }),
    }));

    return {
      ...options,
      xAxis: {
        ...(options.xAxis as any),
        data: sortedData,
      },
      series: sortedSeries,
    };
  };

  const getFlippedOptions = (options: EChartsCoreOption) => {
    if (orientation === 'vertical') return options;

    return {
      ...options,
      xAxis: {
        ...((options.yAxis as any) || {}),
        type: 'value',
        axisLine: {
          show: true,
          lineStyle: {
            color: theme.colors.grayscale.light3,
            width: 1,
          },
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: theme.colors.grayscale.light2,
            width: 1,
            type: 'solid',
          },
        },
        name: (options.yAxis as any)?.name || '',
        nameLocation: 'middle',
      },
      yAxis: {
        ...((options.xAxis as any) || {}),
        type: 'category',
        axisLine: { show: true },
        data: [...(options.xAxis as any).data].reverse(),
        name: (options.xAxis as any)?.name || '',
        nameLocation: 'middle',
      },
      series: Array.isArray(options.series)
        ? options.series.map((series: any) => ({
            ...series,
            encode: {
              x: series.encode?.y,
              y: series.encode?.x,
            },
            data: [...series.data].reverse(),
            label: {
              ...(series.label || {}),
              position: series.name === 'Decrease' ? 'left' : 'right',
            },
          }))
        : [],
    };
  };

  const getFormattedAxisOptions = (options: EChartsCoreOption) => {
    const { xTicksLayout, xTicksWrapLength } = props.formData;

    // If no formatting needed, return original options
    if (!boldTotal && !boldSubTotal && xTicksLayout !== 'flat') {
      return options;
    }

    // Get total indices for bold formatting
    const totalsIndex = boldTotal
      ? ((options.series as any[]) || [])
          .find(series => series.name === 'Total')
          ?.data.map((dataPoint: any, index: number) =>
            dataPoint.value !== '-' ? index : -1,
          )
          .filter((index: number) => index !== -1) || []
      : [];

    const formatText = (value: string, index: number) => {
      // Handle bold formatting first
      let formattedValue = value;

      if (orientation === 'vertical') {
        if (index === 0 && boldSubTotal) {
          formattedValue = `{subtotal|${value}}`;
        } else if (totalsIndex.includes(index) && boldTotal) {
          formattedValue = `{total|${value}}`;
        }
      } else {
        const axisData = (options.yAxis as { data?: any[] })?.data || [];
        const isLast = index === axisData.length - 1;
        if (isLast && boldSubTotal) {
          formattedValue = `{subtotal|${value}}`;
        } else if (totalsIndex.includes(index) && boldTotal) {
          formattedValue = `{total|${value}}`;
        }
      }

      // get the width of xAxis to calculate the maxCharsPerLine
      const getAxisRange = (options: EChartsCoreOption) => {
        if (orientation === 'vertical') {
          const xAxis = options.xAxis as any;
          const grid = options.grid as any;

          // Get actual chart area width accounting for grid margins
          const availableWidth = width - (grid?.left || 0) - (grid?.right || 0);

          if (xAxis?.type === 'value') {
            const range = xAxis.max - xAxis.min;
            return Math.min(range, availableWidth);
          }
          if (xAxis?.type === 'category') {
            const categories = xAxis.data?.length || 1;
            // Calculate space per category
            return availableWidth / categories;
          }
        } else {
          const yAxis = options.yAxis as any;
          const grid = options.grid as any;

          // Get actual chart area height accounting for grid margins
          const availableHeight =
            height - (grid?.top || 0) - (grid?.bottom || 0);

          if (yAxis?.type === 'value') {
            const range = yAxis.max - yAxis.min;
            return Math.min(range, availableHeight);
          }
          if (yAxis?.type === 'category') {
            const categories = yAxis.data?.length || 1;
            // Calculate space per category
            return availableHeight / categories;
          }
        }

        // Fallback to a reasonable default
        return orientation === 'vertical' ? width * 0.8 : height * 0.8;
      };

      // Handle text wrapping if needed
      const maxWidth = getAxisRange(options); // chart width
      const maxCharsPerLine = Math.floor(maxWidth / xTicksWrapLength); // Approx chars per line

      const words = formattedValue.split(' ');
      let line = '';
      let wrappedText = '';

      words.forEach(word => {
        if ((line + word).length > maxCharsPerLine) {
          wrappedText += `${line.trim()}\n`;
          line = `${word} `;
        } else {
          line += `${word} `;
        }
      });

      wrappedText += line.trim();

      return wrappedText;
    };

    if (orientation === 'vertical') {
      return {
        ...options,
        xAxis: {
          ...(options.xAxis as any),
          axisLabel: {
            ...(options.xAxis as any)?.axisLabel,
            formatter: formatText,
            overflow: 'break',
            rich: {
              ...(options.xAxis as any)?.axisLabel?.rich,
              subtotal: boldSubTotal ? { fontWeight: 'bold' } : undefined,
              total: boldTotal ? { fontWeight: 'bold' } : undefined,
            },
          },
        },
      };
    }

    return {
      ...options,
      yAxis: {
        ...(options.yAxis as any),
        axisLabel: {
          ...(options.yAxis as any)?.axisLabel,
          formatter: formatText,
          overflow: 'break',
          rich: {
            ...(options.yAxis as any)?.axisLabel?.rich,
            subtotal: boldSubTotal ? { fontWeight: 'bold' } : undefined,
            total: boldTotal ? { fontWeight: 'bold' } : undefined,
          },
        },
      },
    };
  };

  const getLabelDistanceOptions = (options: EChartsCoreOption) => {
    if (Number.isNaN(Number(xAxisLabelDistance))) {
      console.error('xAxisLabelDistance should be a number');
      return options;
    }

    if (Number.isNaN(Number(yAxisLabelDistance))) {
      console.error('yAxisLabelDistance should be a number');
      return options;
    }

    return {
      ...options,
      xAxis: {
        ...(options.xAxis as any),
        nameGap: Number(xAxisLabelDistance),
      },
      yAxis: {
        ...(options.yAxis as any),
        nameGap: Number(yAxisLabelDistance),
      },
    };
  };

  const subtotalOptions = getSubtotalOptions(echartOptions);
  const showTotalOptions = getShowTotalOptions(subtotalOptions);
  const sortedEchartOptions = getSortedOptions(showTotalOptions);
  const flippedEchartOptions = getFlippedOptions(sortedEchartOptions);
  const formattedAxisOptions = getFormattedAxisOptions(flippedEchartOptions);
  const labelDistanceOptions = getLabelDistanceOptions(formattedAxisOptions);

  return (
    <Echart
      ref={chartRef}
      height={height}
      width={width}
      echartOptions={labelDistanceOptions}
      eventHandlers={eventHandlers}
      refs={refs}
    />
  );
}

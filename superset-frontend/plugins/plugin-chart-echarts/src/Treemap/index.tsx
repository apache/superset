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

/**
 * ECharts Treemap Chart - Glyph Pattern Implementation
 *
 * Show hierarchical relationships of data, with the value represented by area,
 * showing proportion and contribution to the whole.
 */

import { useCallback } from 'react';
import { t } from '@apache-superset/core/translation';
import type { EChartsCoreOption } from 'echarts/core';
import type { TreemapSeriesNodeItemOption } from 'echarts/types/src/chart/treemap/TreemapSeries';
import type { TreemapSeriesOption } from 'echarts/charts';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  Behavior,
  BinaryQueryObjectFilterClause,
  buildQueryContext,
  CategoricalColorNamespace,
  DataRecord,
  DataRecordValue,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  getValueFormatter,
  NumberFormats,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
  SetDataMaskHook,
  ContextMenuFilters,
  tooltipHtml,
  ValueFormatter,
} from '@superset-ui/core';
import { getStandardizedControls } from '@superset-ui/chart-controls';

import {
  defineChart,
  Metric,
  Dimension,
  Checkbox,
  ChartProps,
  SimpleLabelType,
  ShowLabels,
} from '@superset-ui/glyph-core';

import { formatSeriesName, getColtypesMapping } from '../utils/series';
import { treeBuilder, TreeNode } from '../utils/treeBuilder';
import { NULL_STRING, OpacityEnum } from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import Echart from '../components/Echart';
import { EventHandlers, LabelPositionEnum, Refs, TreePathInfo } from '../types';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/treemap_v2_1.png';
import example1Dark from './images/treemap_v2_1-dark.png';
import example2 from './images/treemap_v2_2.jpg';
import example2Dark from './images/treemap_v2_2-dark.jpg';

// ============================================================================
// Types
// ============================================================================

enum EchartsTreemapLabelType {
  Key = 'key',
  Value = 'value',
  KeyValue = 'key_value',
}

interface TreemapSeriesCallbackDataParams extends CallbackDataParams {
  treePathInfo?: TreePathInfo[];
}

interface TreemapTransformResult {
  transformedProps: {
    refs: Refs;
    width: number;
    height: number;
    echartOptions: EChartsCoreOption;
    formData: Record<string, unknown>;
    groupby: QueryFormColumn[];
    labelMap: Record<string, string[]>;
    setDataMask: SetDataMaskHook;
    selectedValues: string[];
    emitCrossFilters?: boolean;
    onContextMenu?: (
      clientX: number,
      clientY: number,
      filters?: ContextMenuFilters,
    ) => void;
    coltypeMapping?: Record<string, number>;
  };
}

// ============================================================================
// Constants
// ============================================================================

const COLOR_SATURATION = [0.7, 0.4];
const LABEL_FONTSIZE = 11;
const BORDER_WIDTH = 0;
const GAP_WIDTH = 0;

const DEFAULT_FORM_DATA = {
  groupby: [],
  labelType: EchartsTreemapLabelType.KeyValue,
  labelPosition: LabelPositionEnum.InsideTopLeft,
  numberFormat: 'SMART_NUMBER',
  showLabels: true,
  showUpperLabels: true,
  dateFormat: 'smart_date',
};

// ============================================================================
// Helpers
// ============================================================================

function extractTreePathInfo(treePathInfo: TreePathInfo[] | undefined) {
  const treePath = (treePathInfo ?? [])
    .map(pathInfo => pathInfo?.name || '')
    .filter(path => path !== '');

  const metricLabel = treePath.shift() || '';
  return { metricLabel, treePath };
}

function formatLabel({
  params,
  labelType,
  numberFormatter,
}: {
  params: TreemapSeriesCallbackDataParams;
  labelType: EchartsTreemapLabelType;
  numberFormatter: ValueFormatter;
}): string {
  const { name = '', value } = params;
  const formattedValue = numberFormatter(value as number);

  switch (labelType) {
    case EchartsTreemapLabelType.Key:
      return name;
    case EchartsTreemapLabelType.Value:
      return formattedValue;
    case EchartsTreemapLabelType.KeyValue:
      return `${name}: ${formattedValue}`;
    default:
      return name;
  }
}

function formatTooltip({
  params,
  numberFormatter,
}: {
  params: TreemapSeriesCallbackDataParams;
  numberFormatter: ValueFormatter;
}): string {
  const { value, treePathInfo = [] } = params;
  const formattedValue = numberFormatter(value as number);
  const { metricLabel, treePath } = extractTreePathInfo(treePathInfo);
  const percentFormatter = getNumberFormatter(NumberFormats.PERCENT_2_POINT);

  let formattedPercent = '';
  const currentNode = treePathInfo[treePathInfo.length - 1];
  const parentNode = treePathInfo[treePathInfo.length - 2];
  if (parentNode) {
    const percent: number = parentNode.value
      ? (currentNode.value as number) / (parentNode.value as number)
      : 0;
    formattedPercent = percentFormatter(percent);
  }
  const row = [metricLabel, formattedValue];
  if (formattedPercent) {
    row.push(formattedPercent);
  }
  return tooltipHtml([row], treePath.join(' ▸ '));
}

// ============================================================================
// Render Component
// ============================================================================

function TreemapRender({
  transformedProps,
}: {
  transformedProps: TreemapTransformResult['transformedProps'];
}) {
  const {
    echartOptions,
    emitCrossFilters,
    groupby,
    height,
    labelMap,
    onContextMenu,
    refs,
    setDataMask,
    selectedValues,
    width,
    formData,
    coltypeMapping,
  } = transformedProps;

  const getCrossFilterDataMask = useCallback(
    (
      data: { children?: unknown },
      treePathInfo: TreePathInfo[] | undefined,
    ) => {
      if (data?.children) {
        return undefined;
      }
      const { treePath } = extractTreePathInfo(treePathInfo);
      const name = treePath.join(',');
      const selected = Object.values(selectedValues);
      let values: string[];
      if (selected.includes(name)) {
        values = selected.filter(v => v !== name);
      } else {
        values = [name];
      }

      const groupbyValues = values.map(value => labelMap[value]);

      return {
        dataMask: {
          extraFormData: {
            filters:
              values.length === 0
                ? []
                : groupby.map((col, idx) => {
                    const val: DataRecordValue[] = groupbyValues.map(
                      v => v[idx],
                    );
                    if (val === null || val === undefined)
                      return {
                        col,
                        op: 'IS NULL' as const,
                      };
                    return {
                      col,
                      op: 'IN' as const,
                      val: val as (string | number | boolean)[],
                    };
                  }),
          },
          filterState: {
            value: groupbyValues.length ? groupbyValues : null,
            selectedValues: values.length ? values : null,
          },
        },
        isCurrentValueSelected: selected.includes(name),
      };
    },
    [groupby, labelMap, selectedValues],
  );

  const handleChange = useCallback(
    (
      data: { children?: unknown },
      treePathInfo: TreePathInfo[] | undefined,
    ) => {
      if (!emitCrossFilters || groupby.length === 0) {
        return;
      }

      const dataMask = getCrossFilterDataMask(data, treePathInfo)?.dataMask;
      if (dataMask) {
        setDataMask(dataMask);
      }
    },
    [emitCrossFilters, getCrossFilterDataMask, groupby.length, setDataMask],
  );

  const eventHandlers: EventHandlers = {
    click: (props: {
      data: { children?: unknown };
      treePathInfo: TreePathInfo[];
    }) => {
      const { data, treePathInfo } = props;
      handleChange(data, treePathInfo);
    },
    contextmenu: async (eventParams: {
      event: { stop: () => void; event: { clientX: number; clientY: number } };
      data: { children?: unknown };
      treePathInfo: TreePathInfo[];
    }) => {
      if (onContextMenu) {
        eventParams.event.stop();
        const { data, treePathInfo } = eventParams;
        const { treePath } = extractTreePathInfo(treePathInfo);
        if (treePath.length > 0) {
          const pointerEvent = eventParams.event.event;
          const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
          const drillByFilters: BinaryQueryObjectFilterClause[] = [];
          treePath.forEach((path, i) => {
            const val = path === 'null' ? NULL_STRING : path;
            drillToDetailFilters.push({
              col: groupby[i],
              op: '==',
              val,
              formattedVal: path,
            });
            drillByFilters.push({
              col: groupby[i],
              op: '==',
              val,
              formattedVal: formatSeriesName(val, {
                timeFormatter: getTimeFormatter(formData.date_format as string),
                numberFormatter: getNumberFormatter(
                  formData.number_format as string,
                ),
                coltype: coltypeMapping?.[getColumnLabel(groupby[i])],
              }),
            });
          });
          onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
            drillToDetail: drillToDetailFilters,
            crossFilter:
              groupby.length > 0
                ? getCrossFilterDataMask(data, treePathInfo)
                : undefined,
            drillBy: { filters: drillByFilters, groupbyFieldName: 'groupby' },
          });
        }
      }
    },
  };

  return (
    <Echart
      refs={refs}
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      selectedValues={selectedValues}
      vizType={formData.vizType as string}
    />
  );
}

// ============================================================================
// Build Query
// ============================================================================

export function buildQuery(formData: QueryFormData) {
  const { metric } = formData;
  const sortByMetric = formData.sort_by_metric;

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      ...(sortByMetric && { orderby: [[metric, false]] }),
    },
  ]);
}

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Treemap'),
    description: t(
      'Show hierarchical relationships of data, with the value represented by area, showing proportion and contribution to the whole.',
    ),
    category: t('Part of a Whole'),
    tags: [
      t('Categorical'),
      t('Comparison'),
      t('ECharts'),
      t('Multi-Levels'),
      t('Percentages'),
      t('Proportional'),
      t('Featured'),
    ],
    behaviors: [
      Behavior.InteractiveChart,
      Behavior.DrillToDetail,
      Behavior.DrillBy,
    ],
    credits: ['https://echarts.apache.org'],
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
    ],
  },

  arguments: {
    groupby: Dimension.with({
      label: t('Dimensions'),
      description: t('Columns to group by on the rows'),
      multi: true,
    }),

    metric: Metric.with({
      label: t('Metric'),
      description: t('Metric used to calculate the area of each rectangle'),
      multi: false,
    }),

    showLabels: ShowLabels,

    showUpperLabels: Checkbox.with({
      label: t('Show Upper Labels'),
      description: t('Show labels when the node has children.'),
      default: true,
    }),

    labelType: SimpleLabelType.with({
      default: 'key_value',
    }),
  },

  additionalControls: {
    query: [['row_limit'], ['sort_by_metric'], ['adhoc_filters']],
    chartOptions: [['color_scheme'], ['currency_format']],
  },

  formDataOverrides: (formData: QueryFormData) => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
    groupby: getStandardizedControls().popAllColumns(),
  }),

  buildQuery,

  transform: (chartProps: ChartProps): TreemapTransformResult => {
    const {
      width,
      height,
      rawFormData,
      hooks,
      filterState,
      queriesData,
      theme,
      inContextMenu,
      emitCrossFilters,
      datasource,
    } = chartProps;

    const { data = [] } = queriesData[0];
    const { columnFormats = {}, currencyFormats = {} } = datasource ?? {};
    const { setDataMask = () => {}, onContextMenu } = hooks ?? {};
    const coltypeMapping = getColtypesMapping(
      queriesData[0] as unknown as Parameters<typeof getColtypesMapping>[0],
    );
    const BORDER_COLOR = theme.colorBgBase;
    const refs: Refs = {};

    // Extract form values with defaults
    const colorScheme = rawFormData.color_scheme as string;
    const groupby = (rawFormData.groupby as QueryFormColumn[]) || [];
    const metric = (rawFormData.metric as QueryFormMetric) || '';
    const labelType =
      (rawFormData.label_type as EchartsTreemapLabelType) ||
      DEFAULT_FORM_DATA.labelType;
    const labelPosition =
      (rawFormData.label_position as LabelPositionEnum) ||
      DEFAULT_FORM_DATA.labelPosition;
    const numberFormat =
      (rawFormData.number_format as string) || DEFAULT_FORM_DATA.numberFormat;
    const currencyFormat = rawFormData.currency_format;
    const dateFormat =
      (rawFormData.date_format as string) || DEFAULT_FORM_DATA.dateFormat;
    const showLabels =
      rawFormData.show_labels !== undefined
        ? (rawFormData.show_labels as boolean)
        : DEFAULT_FORM_DATA.showLabels;
    const showUpperLabels =
      rawFormData.show_upper_labels !== undefined
        ? (rawFormData.show_upper_labels as boolean)
        : DEFAULT_FORM_DATA.showUpperLabels;
    const dashboardId = rawFormData.dashboard_id as number | undefined;
    const sliceId = rawFormData.slice_id as number | undefined;

    const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
    const numberFormatter = getValueFormatter(
      metric,
      currencyFormats,
      columnFormats,
      numberFormat,
      currencyFormat,
    );

    const formatter = (params: TreemapSeriesCallbackDataParams) =>
      formatLabel({
        params,
        numberFormatter,
        labelType,
      });

    const columnsLabelMap = new Map<string, string[]>();
    const metricLabel = getMetricLabel(metric);
    const groupbyLabels = groupby.map(getColumnLabel);
    const treeData = treeBuilder(
      data as DataRecord[],
      groupbyLabels,
      metricLabel,
    );

    const labelProps = {
      color: theme.colorText,
      borderColor: theme.colorBgBase,
      borderWidth: 1,
    };

    const traverse = (
      treeNodes: TreeNode[],
      path: string[],
    ): TreemapSeriesNodeItemOption[] =>
      treeNodes.map(treeNode => {
        const { name: nodeName, value, groupBy } = treeNode;
        const name = formatSeriesName(nodeName, {
          timeFormatter: getTimeFormatter(dateFormat),
          ...(coltypeMapping[groupBy] && {
            coltype: coltypeMapping[groupBy],
          }),
        });
        const newPath = path.concat(name);
        let item: TreemapSeriesNodeItemOption = {
          name,
          value,
          colorSaturation: COLOR_SATURATION,
          itemStyle: {
            borderColor: BORDER_COLOR,
            color: colorFn(name, sliceId),
            borderWidth: BORDER_WIDTH,
            gapWidth: GAP_WIDTH,
          },
        };
        if (treeNode.children?.length) {
          item = {
            ...item,
            children: traverse(treeNode.children, newPath),
          };
        } else {
          const joinedName = newPath.join(',');
          columnsLabelMap.set(joinedName, newPath);
          if (
            filterState?.selectedValues &&
            !filterState.selectedValues.includes(joinedName)
          ) {
            item = {
              ...item,
              itemStyle: {
                colorAlpha: OpacityEnum.SemiTransparent,
                color: theme.colorText,
                borderColor: theme.colorBgBase,
                borderWidth: BORDER_WIDTH,
                gapWidth: GAP_WIDTH,
              },
              label: {
                ...labelProps,
              },
            };
          }
        }
        return item;
      });

    const transformedData: TreemapSeriesNodeItemOption[] = [
      {
        name: metricLabel,
        colorSaturation: COLOR_SATURATION,
        itemStyle: {
          borderColor: BORDER_COLOR,
          color: colorFn(`${metricLabel}`, sliceId),
          borderWidth: BORDER_WIDTH,
          gapWidth: GAP_WIDTH,
        },
        upperLabel: {
          show: false,
        },
        children: traverse(treeData, []),
      },
    ];

    const levels = [
      {
        upperLabel: {
          show: false,
        },
        label: {
          show: false,
        },
        itemStyle: {
          color: theme.colorPrimary,
        },
      },
    ];

    const series: TreemapSeriesOption[] = [
      {
        type: 'treemap',
        width: '100%',
        height: '100%',
        nodeClick: undefined,
        roam: !dashboardId,
        breadcrumb: {
          show: false,
          emptyItemWidth: 25,
        },
        emphasis: {
          label: {
            ...labelProps,
            show: true,
          },
        },
        levels,
        label: {
          ...labelProps,
          show: showLabels,
          position: labelPosition,
          formatter,
          fontSize: LABEL_FONTSIZE,
        },
        upperLabel: {
          ...labelProps,
          show: showUpperLabels,
          formatter,
          textBorderColor: 'transparent',
          fontSize: LABEL_FONTSIZE,
        },
        data: transformedData,
      },
    ];

    const echartOptions: EChartsCoreOption = {
      tooltip: {
        ...getDefaultTooltip(refs),
        show: !inContextMenu,
        trigger: 'item',
        formatter: (params: TreemapSeriesCallbackDataParams) =>
          formatTooltip({
            params,
            numberFormatter,
          }),
      },
      series,
    };

    return {
      transformedProps: {
        refs,
        width,
        height,
        echartOptions,
        formData: rawFormData,
        groupby,
        labelMap: Object.fromEntries(columnsLabelMap),
        setDataMask,
        selectedValues: (filterState?.selectedValues as string[]) || [],
        emitCrossFilters,
        onContextMenu,
        coltypeMapping,
      },
    };
  },

  render: ({ transformedProps }) => (
    <TreemapRender transformedProps={transformedProps} />
  ),
});

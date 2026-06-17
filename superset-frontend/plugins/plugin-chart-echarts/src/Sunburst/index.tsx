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
 * ECharts Sunburst Chart - Glyph Pattern Implementation
 *
 * Uses circles to visualize the flow of data through different stages of a system.
 * Hover over individual paths in the visualization to understand the stages a value took.
 * Useful for multi-stage, multi-group visualizing funnels and pipelines.
 */

import { useCallback } from 'react';
import { t } from '@apache-superset/core/translation';
import type { EChartsCoreOption } from 'echarts/core';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import type { SunburstSeriesNodeItemOption } from 'echarts/types/src/chart/sunburst/SunburstSeries';
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
  getSequentialSchemeRegistry,
  getTimeFormatter,
  getValueFormatter,
  NumberFormats,
  QueryFormColumn,
  QueryFormData,
  SetDataMaskHook,
  ContextMenuFilters,
  tooltipHtml,
  ValueFormatter,
} from '@superset-ui/core';
import {
  D3_FORMAT_DOCS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
  getStandardizedControls,
  ControlPanelsContainerProps,
} from '@superset-ui/chart-controls';

import {
  defineChart,
  Metric,
  Select,
  Checkbox,
  Text,
  ChartProps,
} from '@superset-ui/glyph-core';

import { defaultGrid } from '../defaults';
import { formatSeriesName, getColtypesMapping } from '../utils/series';
import { treeBuilder, TreeNode } from '../utils/treeBuilder';
import { NULL_STRING, OpacityEnum } from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import Echart from '../components/Echart';
import { EventHandlers, Refs, TreePathInfo } from '../types';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/Sunburst1.png';
import example1Dark from './images/Sunburst1-dark.png';
import example2 from './images/Sunburst2.png';
import example2Dark from './images/Sunburst2-dark.png';

// ============================================================================
// Types
// ============================================================================

enum EchartsSunburstLabelType {
  Key = 'key',
  Value = 'value',
  KeyValue = 'key_value',
}

type NodeItemOption = SunburstSeriesNodeItemOption & {
  records: DataRecordValue[];
  secondaryValue: number;
};

interface SunburstTransformResult {
  transformedProps: {
    refs: Refs;
    width: number;
    height: number;
    echartOptions: EChartsCoreOption;
    formData: Record<string, unknown>;
    columns: QueryFormColumn[];
    columnsLabelMap: Map<string, string[]>;
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
// Helpers
// ============================================================================

function getLinearDomain(
  treeData: TreeNode[],
  callback: (treeNode: TreeNode) => number,
): [number, number] {
  let min = 0;
  let max = 0;
  let temp = null;
  function traverse(tree: TreeNode[]) {
    tree.forEach(treeNode => {
      if (treeNode.children?.length) {
        traverse(treeNode.children);
      }
      temp = callback(treeNode);
      if (temp !== null) {
        if (min > temp) min = temp;
        if (max < temp) max = temp;
      }
    });
  }
  traverse(treeData);
  return [min, max];
}

function formatLabel({
  params,
  labelType,
  numberFormatter,
}: {
  params: CallbackDataParams;
  labelType: EchartsSunburstLabelType;
  numberFormatter: ValueFormatter;
}): string {
  const { name = '', value } = params;
  const formattedValue = numberFormatter(value as number);

  switch (labelType) {
    case EchartsSunburstLabelType.Key:
      return name;
    case EchartsSunburstLabelType.Value:
      return formattedValue;
    case EchartsSunburstLabelType.KeyValue:
      return `${name}: ${formattedValue}`;
    default:
      return name;
  }
}

function formatTooltip({
  params,
  primaryValueFormatter,
  secondaryValueFormatter,
  colorByCategory,
  totalValue,
  metricLabel,
  secondaryMetricLabel,
}: {
  params: CallbackDataParams & {
    treePathInfo: {
      name: string;
      dataIndex: number;
      value: number;
    }[];
  };
  primaryValueFormatter: ValueFormatter;
  secondaryValueFormatter: ValueFormatter | undefined;
  colorByCategory: boolean;
  totalValue: number;
  metricLabel: string;
  secondaryMetricLabel?: string;
}): string {
  const { data, treePathInfo = [] } = params;
  const node = data as TreeNode;
  const formattedValue = primaryValueFormatter(node.value);
  const formattedSecondaryValue = secondaryValueFormatter?.(
    node.secondaryValue,
  );

  const percentFormatter = getNumberFormatter(NumberFormats.PERCENT_2_POINT);
  const compareValuePercentage = percentFormatter(
    node.secondaryValue / node.value,
  );
  const absolutePercentage = percentFormatter(node.value / totalValue);
  const parentNode =
    treePathInfo.length > 2 ? treePathInfo[treePathInfo.length - 2] : undefined;

  const title = (node.name || NULL_STRING)
    .toString()
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  const rows: [string, string][] = [[t('% of total'), absolutePercentage]];
  if (parentNode) {
    const conditionalPercentage = percentFormatter(
      node.value / parentNode.value,
    );
    rows.push([t('% of parent'), conditionalPercentage]);
  }
  rows.push([metricLabel, formattedValue]);
  if (!colorByCategory) {
    rows.push([
      secondaryMetricLabel || NULL_STRING,
      formattedSecondaryValue || NULL_STRING,
    ]);
    rows.push([
      `${metricLabel}/${secondaryMetricLabel}`,
      compareValuePercentage,
    ]);
  }
  return tooltipHtml(rows, title);
}

const extractTreePathInfo = (treePathInfo: TreePathInfo[] | undefined) =>
  (treePathInfo ?? [])
    .map(pathInfo => pathInfo?.name || '')
    .filter(path => path !== '');

// ============================================================================
// Render Component
// ============================================================================

function SunburstRender({
  transformedProps,
}: {
  transformedProps: SunburstTransformResult['transformedProps'];
}) {
  const {
    height,
    width,
    echartOptions,
    setDataMask,
    selectedValues,
    formData,
    onContextMenu,
    refs,
    emitCrossFilters,
    coltypeMapping,
    columns,
  } = transformedProps;

  const getCrossFilterDataMask = useCallback(
    (treePathInfo: TreePathInfo[]) => {
      const treePath = extractTreePathInfo(treePathInfo);
      const joinedTreePath = treePath.join(',');
      const value = treePath[treePath.length - 1];

      const isCurrentValueSelected =
        Object.values(selectedValues).includes(joinedTreePath);

      if (!columns?.length || isCurrentValueSelected) {
        return {
          dataMask: {
            extraFormData: {
              filters: [],
            },
            filterState: {
              value: null,
              selectedValues: [],
            },
          },
          isCurrentValueSelected,
        };
      }

      return {
        dataMask: {
          extraFormData: {
            filters: [
              {
                col: columns[treePath.length - 1],
                op: '==' as const,
                val: value,
              },
            ],
          },
          filterState: {
            value,
            selectedValues: [joinedTreePath],
          },
        },
        isCurrentValueSelected,
      };
    },
    [columns, selectedValues],
  );

  const handleChange = useCallback(
    (treePathInfo: TreePathInfo[]) => {
      if (!emitCrossFilters || !columns?.length) {
        return;
      }

      setDataMask(getCrossFilterDataMask(treePathInfo).dataMask);
    },
    [emitCrossFilters, columns?.length, setDataMask, getCrossFilterDataMask],
  );

  const eventHandlers: EventHandlers = {
    click: (props: { treePathInfo: TreePathInfo[] }) => {
      const { treePathInfo } = props;
      handleChange(treePathInfo);
    },
    contextmenu: async (eventParams: {
      event: {
        stop: () => void;
        event: { clientX: number; clientY: number };
      };
      data: { records: DataRecordValue[] };
      treePathInfo: TreePathInfo[];
    }) => {
      if (onContextMenu) {
        eventParams.event.stop();
        const { data, treePathInfo } = eventParams;
        const { records } = data;
        const treePath = extractTreePathInfo(eventParams.treePathInfo);
        const pointerEvent = eventParams.event.event;
        const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
        const drillByFilters: BinaryQueryObjectFilterClause[] = [];
        if (columns?.length) {
          treePath.forEach((path, i) =>
            drillToDetailFilters.push({
              col: columns[i],
              op: '==',
              val: records[i],
              formattedVal: path,
            }),
          );
          const val = treePath[treePath.length - 1];
          drillByFilters.push({
            col: columns[treePath.length - 1],
            op: '==',
            val,
            formattedVal: formatSeriesName(val, {
              timeFormatter: getTimeFormatter(formData.date_format as string),
              numberFormatter: getNumberFormatter(
                formData.number_format as string,
              ),
              coltype:
                coltypeMapping?.[getColumnLabel(columns[treePath.length - 1])],
            }),
          });
        }
        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillToDetailFilters,
          crossFilter: columns?.length
            ? getCrossFilterDataMask(treePathInfo)
            : undefined,
          drillBy: { filters: drillByFilters, groupbyFieldName: 'columns' },
        });
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
    name: t('Sunburst Chart'),
    description: t(
      'Uses circles to visualize the flow of data through different stages of a system. Hover over individual paths in the visualization to understand the stages a value took. Useful for multi-stage, multi-group visualizing funnels and pipelines.',
    ),
    category: t('Part of a Whole'),
    tags: [t('ECharts'), t('Multi-Levels'), t('Proportional'), t('Featured')],
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
    // Labels section
    showLabels: Checkbox.with({
      label: t('Show Labels'),
      description: t('Whether to display the labels.'),
      default: false,
    }),

    showLabelsThreshold: Text.with({
      label: t('Percentage threshold'),
      description: t(
        'Minimum threshold in percentage points for showing labels.',
      ),
      default: '5',
    }),

    showTotal: Checkbox.with({
      label: t('Show Total'),
      description: t('Whether to display the aggregate count'),
      default: false,
    }),

    labelType: Select.with({
      label: t('Label Type'),
      description: t('What should be shown on the label?'),
      options: [
        { label: t('Category Name'), value: 'key' },
        { label: t('Value'), value: 'value' },
        { label: t('Category and Value'), value: 'key_value' },
      ],
      default: 'key',
    }),

    numberFormat: Select.with({
      label: t('Number format'),
      description: `${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`,
      options: D3_FORMAT_OPTIONS.map(([value, label]) => ({
        label: label as string,
        value: value as string,
      })),
      default: 'SMART_NUMBER',
    }),

    dateFormat: Select.with({
      label: t('Date format'),
      description: D3_FORMAT_DOCS,
      options: D3_TIME_FORMAT_OPTIONS.map(([value, label]) => ({
        label: label as string,
        value: value as string,
      })),
      default: 'smart_date',
    }),

    secondaryMetric: Metric.with({
      label: t('Secondary Metric'),
      description: t(
        '[optional] this secondary metric is used to define the color as a ratio against the primary metric. When omitted, the color is categorical and based on labels',
      ),
      multi: false,
    }),
  },

  additionalControls: {
    query: [
      ['columns'],
      ['metric'],
      ['secondary_metric'],
      ['adhoc_filters'],
      ['row_limit'],
      ['sort_by_metric'],
    ],
    chartOptions: [
      ['color_scheme'],
      ['linear_color_scheme'],
      ['currency_format'],
    ],
  },

  additionalControlOverrides: {
    metric: {
      label: t('Primary Metric'),
      description: t(
        'The primary metric is used to define the arc segment sizes',
      ),
    },
    secondary_metric: {
      label: t('Secondary Metric'),
      default: null,
      description: t(
        '[optional] this secondary metric is used to define the color as a ratio against the primary metric. When omitted, the color is categorical and based on labels',
      ),
    },
    color_scheme: {
      description: t(
        'When only a primary metric is provided, a categorical color scale is used.',
      ),
      visibility: ({ controls }: ControlPanelsContainerProps) =>
        Boolean(
          !controls?.secondary_metric?.value ||
          controls?.secondary_metric?.value === controls?.metric.value,
        ),
    },
    linear_color_scheme: {
      description: t(
        'When a secondary metric is provided, a linear color scale is used.',
      ),
      visibility: ({ controls }: ControlPanelsContainerProps) =>
        Boolean(
          controls?.secondary_metric?.value &&
          controls?.secondary_metric?.value !== controls?.metric.value,
        ),
    },
    columns: {
      label: t('Hierarchy'),
      description: t(`Sets the hierarchy levels of the chart. Each level is
        represented by one ring with the innermost circle as the top of the hierarchy.`),
    },
  },

  formDataOverrides: (formData: QueryFormData) => ({
    ...formData,
    groupby: getStandardizedControls().popAllColumns(),
    metric: getStandardizedControls().shiftMetric(),
    secondary_metric: getStandardizedControls().shiftMetric(),
  }),

  buildQuery,

  transform: (chartProps: ChartProps): SunburstTransformResult => {
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
    const { setDataMask = () => {}, onContextMenu } = hooks ?? {};
    const coltypeMapping = getColtypesMapping(
      queriesData[0] as unknown as Parameters<typeof getColtypesMapping>[0],
    );
    const refs: Refs = {};

    // Extract form values
    const columns = (rawFormData.columns as QueryFormColumn[]) || [];
    const metric = rawFormData.metric || '';
    const secondaryMetric = rawFormData.secondary_metric || '';
    const colorScheme = rawFormData.color_scheme as string;
    const linearColorScheme = rawFormData.linear_color_scheme as string;
    const labelType =
      (rawFormData.label_type as EchartsSunburstLabelType) ||
      EchartsSunburstLabelType.Key;
    const numberFormat =
      (rawFormData.number_format as string) || 'SMART_NUMBER';
    const currencyFormat = rawFormData.currency_format;
    const dateFormat = (rawFormData.date_format as string) || 'smart_date';
    const showLabels = rawFormData.show_labels as boolean;
    const showLabelsThreshold = parseFloat(
      (rawFormData.show_labels_threshold as string) || '5',
    );
    const showTotal = rawFormData.show_total as boolean;
    const sliceId = rawFormData.slice_id as number | undefined;

    const {
      currencyFormats = {},
      columnFormats = {},
      verboseMap = {},
    } = datasource ?? {};

    const primaryValueFormatter = getValueFormatter(
      metric,
      currencyFormats,
      columnFormats,
      numberFormat,
      currencyFormat,
    );
    const secondaryValueFormatter = secondaryMetric
      ? getValueFormatter(
          secondaryMetric,
          currencyFormats,
          columnFormats,
          numberFormat,
          currencyFormat,
        )
      : undefined;

    const numberFormatter = getNumberFormatter(numberFormat);
    const formatter = (params: CallbackDataParams) =>
      formatLabel({
        params,
        numberFormatter: primaryValueFormatter,
        labelType,
      });
    const minShowLabelAngle = (showLabelsThreshold || 0) * 3.6;
    const padding = {
      top: theme.sizeUnit * 3,
      right: theme.sizeUnit,
      bottom: theme.sizeUnit * 3,
      left: theme.sizeUnit,
    };
    const containerWidth = width;
    const containerHeight = height;
    const visWidth = containerWidth - padding.left - padding.right;
    const visHeight = containerHeight - padding.top - padding.bottom;
    const radius = Math.min(visWidth, visHeight) / 2;

    const columnsLabelMap = new Map<string, string[]>();
    const metricLabel = getMetricLabel(metric);
    const secondaryMetricLabel = secondaryMetric
      ? getMetricLabel(secondaryMetric)
      : undefined;
    const columnLabels = columns.map(getColumnLabel);
    const treeData = treeBuilder(
      data as DataRecord[],
      columnLabels,
      metricLabel,
      secondaryMetricLabel,
    );
    const totalValue = treeData.reduce(
      (result, treeNode) => result + treeNode.value,
      0,
    );
    const totalSecondaryValue = treeData.reduce(
      (result, treeNode) => result + treeNode.secondaryValue,
      0,
    );

    const categoricalColorScale = CategoricalColorNamespace.getScale(
      colorScheme as string,
    );
    let linearColorScale: ((value: number) => string) | undefined;
    let colorByCategory = true;
    if (secondaryMetric && metric !== secondaryMetric) {
      const domain = getLinearDomain(
        treeData,
        node => node.secondaryValue / node.value,
      );
      colorByCategory = false;
      linearColorScale = getSequentialSchemeRegistry()
        ?.get(linearColorScheme)
        ?.createLinearScale(domain) as ((value: number) => string) | undefined;
    }

    // Add a base color to keep feature parity
    if (colorByCategory) {
      categoricalColorScale(metricLabel, sliceId);
    } else if (linearColorScale) {
      linearColorScale(totalSecondaryValue / totalValue);
    }

    const labelProps = {
      color: theme.colorText,
      textBorderColor: theme.colorBgBase,
      textBorderWidth: 1,
    };

    const traverse = (
      treeNodes: TreeNode[],
      path: string[],
      pathRecords?: DataRecordValue[],
    ): NodeItemOption[] =>
      treeNodes.map(treeNode => {
        const { name: nodeName, value, secondaryValue, groupBy } = treeNode;
        const records = [...(pathRecords || []), nodeName];
        let name = formatSeriesName(nodeName, {
          numberFormatter,
          timeFormatter: getTimeFormatter(dateFormat),
          ...(coltypeMapping[groupBy] && {
            coltype: coltypeMapping[groupBy],
          }),
        });
        const newPath = path.concat(name);
        let item: NodeItemOption = {
          records,
          name,
          value,
          secondaryValue,
          itemStyle: {
            color: colorByCategory
              ? categoricalColorScale(name, sliceId)
              : linearColorScale?.(secondaryValue / value),
          },
        };
        if (treeNode.children?.length) {
          item.children = traverse(
            treeNode.children,
            newPath,
            records,
          ) as NodeItemOption['children'];
        } else {
          name = newPath.join(',');
        }
        columnsLabelMap.set(name, newPath);
        if (filterState?.selectedValues?.[0]?.includes(name) === false) {
          item = {
            ...item,
            itemStyle: {
              ...item.itemStyle,
              opacity: OpacityEnum.SemiTransparent,
            },
            label: {
              ...labelProps,
            },
          };
        }
        return item;
      });

    const echartOptions: EChartsCoreOption = {
      grid: {
        ...defaultGrid,
      },
      tooltip: {
        ...getDefaultTooltip(refs),
        show: !inContextMenu,
        trigger: 'item',
        formatter: (params: CallbackDataParams) =>
          formatTooltip({
            params: params as CallbackDataParams & {
              treePathInfo: {
                name: string;
                dataIndex: number;
                value: number;
              }[];
            },
            primaryValueFormatter,
            secondaryValueFormatter,
            colorByCategory,
            totalValue,
            metricLabel: verboseMap[metricLabel] || metricLabel,
            secondaryMetricLabel: secondaryMetricLabel
              ? verboseMap[secondaryMetricLabel] || secondaryMetricLabel
              : undefined,
          }),
      },
      series: [
        {
          type: 'sunburst',
          ...padding,
          nodeClick: false,
          emphasis: {
            focus: 'ancestor',
            label: {
              show: showLabels,
            },
          },
          label: {
            ...labelProps,
            width: (radius * 0.6) / (columns.length || 1),
            show: showLabels,
            formatter,
            minAngle: minShowLabelAngle,
            overflow: 'breakAll',
          },
          radius: [radius * 0.3, radius],
          data: traverse(treeData, []),
        },
      ],
      graphic: showTotal
        ? {
            type: 'text',
            top: 'center',
            left: 'center',
            style: {
              text: t('Total: %s', primaryValueFormatter(totalValue)),
              fontSize: 16,
              fontWeight: 'bold',
            },
            z: 10,
          }
        : null,
    };

    return {
      transformedProps: {
        refs,
        width,
        height,
        echartOptions,
        formData: rawFormData,
        columns,
        columnsLabelMap,
        setDataMask,
        selectedValues: (filterState?.selectedValues as string[]) || [],
        emitCrossFilters,
        onContextMenu,
        coltypeMapping,
      },
    };
  },

  render: ({ transformedProps }) => (
    <SunburstRender transformedProps={transformedProps} />
  ),
});

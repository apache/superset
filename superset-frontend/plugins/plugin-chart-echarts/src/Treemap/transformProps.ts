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
import {
  CategoricalColorNamespace,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  NumberFormats,
  ValueFormatter,
  getValueFormatter,
  tooltipHtml,
} from '@superset-ui/core';
import type { TreemapSeriesNodeItemOption } from 'echarts/types/src/chart/treemap/TreemapSeries';
import type { EChartsCoreOption } from 'echarts/core';
import type { TreemapSeriesOption } from 'echarts/charts';
import {
  DEFAULT_FORM_DATA as DEFAULT_TREEMAP_FORM_DATA,
  EchartsTreemapChartProps,
  EchartsTreemapFormData,
  EchartsTreemapLabelType,
  TreemapSeriesCallbackDataParams,
  TreemapTransformedProps,
} from './types';
import { formatSeriesName, getColtypesMapping } from '../utils/series';
import {
  COLOR_SATURATION,
  BORDER_WIDTH,
  GAP_WIDTH,
  LABEL_FONTSIZE,
  extractTreePathInfo,
  BORDER_COLOR,
} from './constants';
import { OpacityEnum } from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs } from '../types';
import { treeBuilder, TreeNode } from '../utils/treeBuilder';

export function formatLabel({
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

export function formatTooltip({
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
  // the last item is current node, here we should find the parent node
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

export default function transformProps(
  chartProps: EchartsTreemapChartProps,
): TreemapTransformedProps {
  const {
    formData,
    height,
    queriesData,
    width,
    hooks,
    filterState,
    theme,
    inContextMenu,
    emitCrossFilters,
    datasource,
  } = chartProps;
  const { data = [] } = queriesData[0];
  const { columnFormats = {}, currencyFormats = {} } = datasource;
  const { setDataMask = () => {}, onContextMenu } = hooks;
  const coltypeMapping = getColtypesMapping(queriesData[0]);

  const {
    colorScheme,
    groupby = [],
    metric = '',
    labelType,
    labelPosition,
    numberFormat,
    currencyFormat,
    dateFormat,
    showLabels,
    showUpperLabels,
    dashboardId,
    sliceId,
  }: EchartsTreemapFormData = {
    ...DEFAULT_TREEMAP_FORM_DATA,
    ...formData,
  };
  const refs: Refs = {};
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
  const treeData = treeBuilder(data, groupbyLabels, metricLabel);
  const traverse = (treeNodes: TreeNode[], path: string[]) =>
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
      };
      if (treeNode.children?.length) {
        item = {
          ...item,
          children: traverse(treeNode.children, newPath),
          colorSaturation: COLOR_SATURATION,
          itemStyle: {
            borderColor: BORDER_COLOR,
            color: colorFn(name, sliceId, colorScheme),
            borderWidth: BORDER_WIDTH,
            gapWidth: GAP_WIDTH,
          },
        };
      } else {
        const joinedName = newPath.join(',');
        // map(joined_name: [columnLabel_1, columnLabel_2, ...])
        columnsLabelMap.set(joinedName, newPath);
        if (
          filterState.selectedValues &&
          !filterState.selectedValues.includes(joinedName)
        ) {
          item = {
            ...item,
            itemStyle: {
              colorAlpha: OpacityEnum.SemiTransparent,
            },
            label: {
              color: `rgba(0, 0, 0, ${OpacityEnum.SemiTransparent})`,
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
        color: colorFn(`${metricLabel}`, sliceId, colorScheme),
        borderWidth: BORDER_WIDTH,
        gapWidth: GAP_WIDTH,
      },
      upperLabel: {
        show: false,
      },
      children: traverse(treeData, []),
    },
  ];

  // set a default color when metric values are 0 over all.
  const levels = [
    {
      upperLabel: {
        show: false,
      },
      label: {
        show: false,
      },
      itemStyle: {
        color: theme.colors.primary.base,
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
          show: true,
        },
      },
      levels,
      label: {
        show: showLabels,
        position: labelPosition,
        formatter,
        color: theme.colors.grayscale.dark2,
        fontSize: LABEL_FONTSIZE,
      },
      upperLabel: {
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
      formatter: (params: any) =>
        formatTooltip({
          params,
          numberFormatter,
        }),
    },
    series,
  };

  return {
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    emitCrossFilters,
    labelMap: Object.fromEntries(columnsLabelMap),
    groupby,
    selectedValues: filterState.selectedValues || [],
    onContextMenu,
    refs,
    coltypeMapping,
  };
}

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
  DataRecordValue,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getSequentialSchemeRegistry,
  getTimeFormatter,
  getValueFormatter,
  NumberFormats,
  SupersetTheme,
  t,
  ValueFormatter,
} from '@superset-ui/core';
import { EChartsCoreOption } from 'echarts';
import { CallbackDataParams } from 'echarts/types/src/util/types';
import { NULL_STRING, OpacityEnum } from '../constants';
import { defaultGrid } from '../defaults';
import { Refs } from '../types';
import { formatSeriesName, getColtypesMapping } from '../utils/series';
import { treeBuilder, TreeNode } from '../utils/treeBuilder';
import {
  EchartsSunburstChartProps,
  EchartsSunburstLabelType,
  NodeItemOption,
  SunburstTransformedProps,
} from './types';
import { getDefaultTooltip } from '../utils/tooltip';

export function getLinearDomain(
  treeData: TreeNode[],
  callback: (treeNode: TreeNode) => number,
) {
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

export function formatLabel({
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

export function formatTooltip({
  params,
  primaryValueFormatter,
  secondaryValueFormatter,
  colorByCategory,
  totalValue,
  metricLabel,
  secondaryMetricLabel,
  theme,
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
  theme: SupersetTheme;
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

  const result = [
    `<div style="
      font-size: ${theme.typography.sizes.m}px;
      color: ${theme.colors.grayscale.base}"
     >`,
    `<div style="font-weight: ${theme.typography.weights.bold}">
      ${(node.name || NULL_STRING)
        .toString()
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')}
     </div>`,
    `<div">
      ${absolutePercentage} of total
     </div>`,
  ];
  if (parentNode) {
    const conditionalPercentage = percentFormatter(
      node.value / parentNode.value,
    );
    result.push(`
    <div>
      ${conditionalPercentage} of ${parentNode.name}
    </div>`);
  }
  result.push(
    `<div>
    ${metricLabel}: ${formattedValue}${
      colorByCategory
        ? ''
        : `, ${secondaryMetricLabel}: ${formattedSecondaryValue}`
    }
     </div>`,
    colorByCategory
      ? ''
      : `<div>${metricLabel}/${secondaryMetricLabel}: ${compareValuePercentage}</div>`,
  );
  result.push('</div>');
  return result.join('\n');
}

export default function transformProps(
  chartProps: EchartsSunburstChartProps,
): SunburstTransformedProps {
  const {
    formData,
    height,
    hooks,
    filterState,
    queriesData,
    width,
    theme,
    inContextMenu,
    emitCrossFilters,
    datasource,
  } = chartProps;
  const { data = [] } = queriesData[0];
  const coltypeMapping = getColtypesMapping(queriesData[0]);
  const {
    groupby = [],
    columns = [],
    metric = '',
    secondaryMetric = '',
    colorScheme,
    linearColorScheme,
    labelType,
    numberFormat,
    currencyFormat,
    dateFormat,
    showLabels,
    showLabelsThreshold,
    showTotal,
    sliceId,
  } = formData;
  const { currencyFormats = {}, columnFormats = {} } = datasource;
  const refs: Refs = {};
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
    top: theme.gridUnit * 3,
    right: theme.gridUnit,
    bottom: theme.gridUnit * 3,
    left: theme.gridUnit,
  };
  const containerWidth = width;
  const containerHeight = height;
  const visWidth = containerWidth - padding.left - padding.right;
  const visHeight = containerHeight - padding.top - padding.bottom;
  const radius = Math.min(visWidth, visHeight) / 2;
  const { setDataMask = () => {}, onContextMenu } = hooks;
  const columnsLabelMap = new Map<string, string[]>();
  const metricLabel = getMetricLabel(metric);
  const secondaryMetricLabel = secondaryMetric
    ? getMetricLabel(secondaryMetric)
    : undefined;
  const columnLabels = columns.map(getColumnLabel);
  const treeData = treeBuilder(
    data,
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
  let linearColorScale: any;
  let colorByCategory = true;
  if (secondaryMetric && metric !== secondaryMetric) {
    const domain = getLinearDomain(
      treeData,
      node => node.secondaryValue / node.value,
    );
    colorByCategory = false;
    linearColorScale = getSequentialSchemeRegistry()
      ?.get(linearColorScheme)
      ?.createLinearScale(domain);
  }

  // add a base color to keep feature parity
  if (colorByCategory) {
    categoricalColorScale(metricLabel, sliceId);
  } else {
    linearColorScale(totalSecondaryValue / totalValue);
  }

  const traverse = (
    treeNodes: TreeNode[],
    path: string[],
    pathRecords?: DataRecordValue[],
  ) =>
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
            : linearColorScale(secondaryValue / value),
        },
      };
      if (treeNode.children?.length) {
        item.children = traverse(treeNode.children, newPath, records);
      } else {
        name = newPath.join(',');
      }
      columnsLabelMap.set(name, newPath);
      if (filterState.selectedValues?.[0]?.includes(name) === false) {
        item = {
          ...item,
          itemStyle: {
            ...item.itemStyle,
            opacity: OpacityEnum.SemiTransparent,
          },
          label: {
            color: `rgba(0, 0, 0, ${OpacityEnum.SemiTransparent})`,
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
      formatter: (params: any) =>
        formatTooltip({
          params,
          primaryValueFormatter,
          secondaryValueFormatter,
          colorByCategory,
          totalValue,
          metricLabel,
          secondaryMetricLabel,
          theme,
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
          width: (radius * 0.6) / (columns.length || 1),
          show: showLabels,
          formatter,
          color: theme.colors.grayscale.dark2,
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

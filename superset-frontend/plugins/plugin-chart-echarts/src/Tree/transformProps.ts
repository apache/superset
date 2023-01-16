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
import { getMetricLabel, DataRecordValue } from '@superset-ui/core';
import { EChartsCoreOption, TreeSeriesOption } from 'echarts';
import {
  TreeSeriesCallbackDataParams,
  TreeSeriesNodeItemOption,
} from 'echarts/types/src/chart/tree/TreeSeries';
import { OptionName } from 'echarts/types/src/util/types';
import {
  EchartsTreeChartProps,
  EchartsTreeFormData,
  TreeDataRecord,
  TreeTransformedProps,
} from './types';
import { DEFAULT_FORM_DATA, DEFAULT_TREE_SERIES_OPTION } from './constants';
import { Refs } from '../types';
import { getDefaultTooltip } from '../utils/tooltip';

export function formatTooltip({
  params,
  metricLabel,
}: {
  params: TreeSeriesCallbackDataParams;
  metricLabel: string;
}): string {
  const { value, treeAncestors } = params;
  const treePath = (treeAncestors ?? [])
    .map(pathInfo => pathInfo?.name || '')
    .filter(path => path !== '');

  return [
    `<div>${treePath.join(' ▸ ')}</div>`,
    value ? `${metricLabel}: ${value}` : '',
  ].join('');
}

export default function transformProps(
  chartProps: EchartsTreeChartProps,
): TreeTransformedProps {
  const { width, height, formData, queriesData } = chartProps;
  const refs: Refs = {};
  const data: TreeDataRecord[] = queriesData[0].data || [];

  const {
    id,
    parent,
    name,
    metric = '',
    rootNodeId,
    layout,
    orient,
    symbol,
    symbolSize,
    roam,
    nodeLabelPosition,
    childLabelPosition,
    emphasis,
  }: EchartsTreeFormData = { ...DEFAULT_FORM_DATA, ...formData };
  const metricLabel = getMetricLabel(metric);

  const nameColumn = name || id;

  function findNodeName(rootNodeId: DataRecordValue): OptionName {
    let nodeName: DataRecordValue = '';
    data.some(node => {
      if (node[id]!.toString() === rootNodeId) {
        nodeName = node[nameColumn];
        return true;
      }
      return false;
    });
    return nodeName;
  }

  function getTotalChildren(tree: TreeSeriesNodeItemOption) {
    let totalChildren = 0;

    function traverse(tree: TreeSeriesNodeItemOption) {
      tree.children!.forEach(node => {
        traverse(node);
      });
      totalChildren += 1;
    }
    traverse(tree);
    return totalChildren;
  }

  function createTree(rootNodeId: DataRecordValue): TreeSeriesNodeItemOption {
    const rootNodeName = findNodeName(rootNodeId);
    const tree: TreeSeriesNodeItemOption = { name: rootNodeName, children: [] };
    const children: TreeSeriesNodeItemOption[][] = [];
    const indexMap: { [name: string]: number } = {};

    if (!rootNodeName) {
      return tree;
    }

    // index indexMap with node ids
    for (let i = 0; i < data.length; i += 1) {
      const nodeId = data[i][id] as number;
      indexMap[nodeId] = i;
      children[i] = [];
    }

    // generate tree
    for (let i = 0; i < data.length; i += 1) {
      const node = data[i];
      if (node[parent]?.toString() === rootNodeId) {
        tree.children?.push({
          name: node[nameColumn],
          children: children[i],
          value: node[metricLabel],
        });
      } else {
        const parentId = node[parent];
        if (data[indexMap[parentId]]) {
          const parentIndex = indexMap[parentId];
          children[parentIndex].push({
            name: node[nameColumn],
            children: children[i],
            value: node[metricLabel],
          });
        }
      }
    }

    return tree;
  }

  let finalTree = {};

  if (rootNodeId) {
    finalTree = createTree(rootNodeId);
  } else {
    /*
      to select root node,
      1.find parent nodes with only 1 child.
      2.build tree for each such child nodes as root
      3.select tree with most children
    */
    // create map of parent:children
    const parentChildMap: { [name: string]: { [name: string]: any } } = {};
    data.forEach(node => {
      const parentId = node[parent] as string;
      if (parentId in parentChildMap) {
        parentChildMap[parentId].push({ id: node[id] });
      } else {
        parentChildMap[parentId] = [{ id: node[id] }];
      }
    });

    // for each parent node which has only 1 child,find tree and select node with max number of children.
    let maxChildren = 0;
    Object.keys(parentChildMap).forEach(key => {
      if (parentChildMap[key].length === 1) {
        const tree = createTree(parentChildMap[key][0].id);
        const totalChildren = getTotalChildren(tree);
        if (totalChildren > maxChildren) {
          maxChildren = totalChildren;
          finalTree = tree;
        }
      }
    });
  }

  const series: TreeSeriesOption[] = [
    {
      type: 'tree',
      data: [finalTree],
      label: {
        ...DEFAULT_TREE_SERIES_OPTION.label,
        position: nodeLabelPosition,
      },
      emphasis: { focus: emphasis },
      animation: DEFAULT_TREE_SERIES_OPTION.animation,
      layout,
      orient,
      symbol,
      roam,
      symbolSize,
      lineStyle: DEFAULT_TREE_SERIES_OPTION.lineStyle,
      select: DEFAULT_TREE_SERIES_OPTION.select,
      leaves: { label: { position: childLabelPosition } },
    },
  ];

  const echartOptions: EChartsCoreOption = {
    animationDuration: DEFAULT_TREE_SERIES_OPTION.animationDuration,
    animationEasing: DEFAULT_TREE_SERIES_OPTION.animationEasing,
    series,
    tooltip: {
      ...getDefaultTooltip(refs),
      trigger: 'item',
      triggerOn: 'mousemove',
      formatter: (params: any) =>
        formatTooltip({
          params,
          metricLabel,
        }),
    },
  };

  return {
    formData,
    width,
    height,
    echartOptions,
    refs,
  };
}

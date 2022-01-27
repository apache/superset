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
import { getMetricLabel } from '@superset-ui/core';
import { DEFAULT_FORM_DATA as DEFAULT_GRAPH_FORM_DATA, } from './types';
import { DEFAULT_TREE_SERIES_OPTION } from './constants';
export function formatTooltip({ params, metricLabel, }) {
    const { value, treeAncestors } = params;
    const treePath = (treeAncestors ?? [])
        .map(pathInfo => pathInfo?.name || '')
        .filter(path => path !== '');
    return [
        `<div>${treePath.join(' ▸ ')}</div>`,
        value ? `${metricLabel}: ${value}` : '',
    ].join('');
}
export default function transformProps(chartProps) {
    const { width, height, formData, queriesData } = chartProps;
    const data = queriesData[0].data || [];
    const { id, parent, name, metric = '', rootNodeId, layout, orient, symbol, symbolSize, roam, nodeLabelPosition, childLabelPosition, emphasis, } = { ...DEFAULT_GRAPH_FORM_DATA, ...formData };
    const metricLabel = getMetricLabel(metric);
    const nameColumn = name || id;
    function findNodeName(rootNodeId) {
        let nodeName = '';
        data.some(node => {
            if (node[id].toString() === rootNodeId) {
                nodeName = node[nameColumn];
                return true;
            }
            return false;
        });
        return nodeName;
    }
    function getTotalChildren(tree) {
        let totalChildren = 0;
        function traverse(tree) {
            tree.children.forEach(node => {
                traverse(node);
            });
            totalChildren += 1;
        }
        traverse(tree);
        return totalChildren;
    }
    function createTree(rootNodeId) {
        const rootNodeName = findNodeName(rootNodeId);
        const tree = { name: rootNodeName, children: [] };
        const children = [];
        const indexMap = {};
        if (!rootNodeName) {
            return tree;
        }
        // index indexMap with node ids
        for (let i = 0; i < data.length; i += 1) {
            const nodeId = data[i][id];
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
            }
            else {
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
    }
    else {
        /*
          to select root node,
          1.find parent nodes with only 1 child.
          2.build tree for each such child nodes as root
          3.select tree with most children
        */
        // create map of parent:children
        const parentChildMap = {};
        data.forEach(node => {
            const parentId = node[parent];
            if (parentId in parentChildMap) {
                parentChildMap[parentId].push({ id: node[id] });
            }
            else {
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
    const series = [
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
    const echartOptions = {
        animationDuration: DEFAULT_TREE_SERIES_OPTION.animationDuration,
        animationEasing: DEFAULT_TREE_SERIES_OPTION.animationEasing,
        series,
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            formatter: (params) => formatTooltip({
                params,
                metricLabel,
            }),
        },
    };
    return {
        width,
        height,
        echartOptions,
    };
}
//# sourceMappingURL=transformProps.js.map
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
import { CategoricalColorNamespace, getMetricLabel, } from '@superset-ui/core';
import { extent as d3Extent } from 'd3-array';
import { DEFAULT_FORM_DATA as DEFAULT_GRAPH_FORM_DATA, } from './types';
import { DEFAULT_GRAPH_SERIES_OPTION } from './constants';
import { getChartPadding, getLegendProps, sanitizeHtml } from '../utils/series';
function verifyEdgeSymbol(symbol) {
    if (symbol === 'none' || symbol === 'circle' || symbol === 'arrow') {
        return symbol;
    }
    return 'none';
}
function parseEdgeSymbol(symbols) {
    const [start, end] = (symbols || '').split(',');
    return [verifyEdgeSymbol(start), verifyEdgeSymbol(end)];
}
/**
 * Emphasized edge width with a min and max.
 */
function getEmphasizedEdgeWidth(width) {
    return Math.max(5, Math.min(width * 2, 20));
}
/**
 * Normalize node size, edge width, and apply label visibility thresholds.
 */
function normalizeStyles(nodes, links, { baseNodeSize, baseEdgeWidth, showSymbolThreshold, }) {
    const minNodeSize = baseNodeSize * 0.5;
    const maxNodeSize = baseNodeSize * 2;
    const minEdgeWidth = baseEdgeWidth * 0.5;
    const maxEdgeWidth = baseEdgeWidth * 2;
    const [nodeMinValue, nodeMaxValue] = d3Extent(nodes, x => x.value);
    const nodeSpread = nodeMaxValue - nodeMinValue;
    nodes.forEach(node => {
        // eslint-disable-next-line no-param-reassign
        node.symbolSize =
            (((node.value - nodeMinValue) / nodeSpread) * maxNodeSize || 0) +
                minNodeSize;
        // eslint-disable-next-line no-param-reassign
        node.label = {
            ...node.label,
            show: showSymbolThreshold ? node.value > showSymbolThreshold : true,
        };
    });
    const [linkMinValue, linkMaxValue] = d3Extent(links, x => x.value);
    const linkSpread = linkMaxValue - linkMinValue;
    links.forEach(link => {
        const lineWidth = ((link.value - linkMinValue) / linkSpread) * maxEdgeWidth ||
            0 + minEdgeWidth;
        // eslint-disable-next-line no-param-reassign
        link.lineStyle.width = lineWidth;
        // eslint-disable-next-line no-param-reassign
        link.emphasis.lineStyle = {
            ...link.emphasis.lineStyle,
            width: getEmphasizedEdgeWidth(lineWidth),
        };
        // eslint-disable-next-line no-param-reassign
        link.select.lineStyle = {
            ...link.select.lineStyle,
            width: getEmphasizedEdgeWidth(lineWidth * 0.8),
            opacity: 1,
        };
    });
}
function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}
function edgeFormatter(sourceIndex, targetIndex, value, nodes) {
    const source = Number(sourceIndex);
    const target = Number(targetIndex);
    return `${sanitizeHtml(getKeyByValue(nodes, source))} > ${sanitizeHtml(getKeyByValue(nodes, target))} : ${value}`;
}
function getCategoryName(columnName, name) {
    if (name === false) {
        return `${columnName}: false`;
    }
    if (name === true) {
        return `${columnName}: true`;
    }
    if (name == null) {
        return 'N/A';
    }
    return String(name);
}
export default function transformProps(chartProps) {
    const { width, height, formData, queriesData } = chartProps;
    const data = queriesData[0].data || [];
    const { source, target, sourceCategory, targetCategory, colorScheme, metric = '', layout, roam, draggable, selectedMode, showSymbolThreshold, edgeLength, gravity, repulsion, friction, legendMargin, legendOrientation, legendType, showLegend, baseEdgeWidth, baseNodeSize, edgeSymbol, } = { ...DEFAULT_GRAPH_FORM_DATA, ...formData };
    const metricLabel = getMetricLabel(metric);
    const colorFn = CategoricalColorNamespace.getScale(colorScheme);
    const nodes = {};
    const categories = new Set();
    const echartNodes = [];
    const echartLinks = [];
    /**
     * Get the node id of an existing node,
     * or create a new node if it doesn't exist.
     */
    function getOrCreateNode(name, category) {
        if (!(name in nodes)) {
            nodes[name] = echartNodes.length;
            echartNodes.push({
                id: String(nodes[name]),
                name,
                value: 0,
                category,
                select: DEFAULT_GRAPH_SERIES_OPTION.select,
                tooltip: DEFAULT_GRAPH_SERIES_OPTION.tooltip,
            });
        }
        const node = echartNodes[nodes[name]];
        if (category) {
            categories.add(category);
            // category may be empty when one of `sourceCategory`
            // or `targetCategory` is not set.
            if (!node.category) {
                node.category = category;
            }
        }
        return node;
    }
    data.forEach(link => {
        const value = link[metricLabel];
        if (!value) {
            return;
        }
        const sourceName = link[source];
        const targetName = link[target];
        const sourceCategoryName = sourceCategory
            ? getCategoryName(sourceCategory, link[sourceCategory])
            : undefined;
        const targetCategoryName = targetCategory
            ? getCategoryName(targetCategory, link[targetCategory])
            : undefined;
        const sourceNode = getOrCreateNode(sourceName, sourceCategoryName);
        const targetNode = getOrCreateNode(targetName, targetCategoryName);
        sourceNode.value += value;
        targetNode.value += value;
        echartLinks.push({
            source: sourceNode.id,
            target: targetNode.id,
            value,
            lineStyle: {},
            emphasis: {},
            select: {},
        });
    });
    normalizeStyles(echartNodes, echartLinks, {
        showSymbolThreshold,
        baseEdgeWidth,
        baseNodeSize,
    });
    const categoryList = [...categories];
    const series = [
        {
            zoom: DEFAULT_GRAPH_SERIES_OPTION.zoom,
            type: 'graph',
            categories: categoryList.map(c => ({
                name: c,
                itemStyle: { color: colorFn(c) },
            })),
            layout,
            force: {
                ...DEFAULT_GRAPH_SERIES_OPTION.force,
                edgeLength,
                gravity,
                repulsion,
                friction,
            },
            circular: DEFAULT_GRAPH_SERIES_OPTION.circular,
            data: echartNodes,
            links: echartLinks,
            roam,
            draggable,
            edgeSymbol: parseEdgeSymbol(edgeSymbol),
            edgeSymbolSize: baseEdgeWidth * 2,
            selectedMode,
            ...getChartPadding(showLegend, legendOrientation, legendMargin),
            animation: DEFAULT_GRAPH_SERIES_OPTION.animation,
            label: DEFAULT_GRAPH_SERIES_OPTION.label,
            lineStyle: DEFAULT_GRAPH_SERIES_OPTION.lineStyle,
            emphasis: DEFAULT_GRAPH_SERIES_OPTION.emphasis,
        },
    ];
    const echartOptions = {
        animationDuration: DEFAULT_GRAPH_SERIES_OPTION.animationDuration,
        animationEasing: DEFAULT_GRAPH_SERIES_OPTION.animationEasing,
        tooltip: {
            formatter: (params) => edgeFormatter(params.data.source, params.data.target, params.value, nodes),
        },
        legend: {
            ...getLegendProps(legendType, legendOrientation, showLegend),
            data: categoryList,
        },
        series,
    };
    return {
        width,
        height,
        echartOptions,
    };
}
//# sourceMappingURL=transformProps.js.map
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
 * ECharts Tree Chart - Glyph Pattern Implementation
 *
 * Visualizes hierarchical data using a tree structure with nodes and edges.
 */

import { t } from '@apache-superset/core/translation';
import type { EChartsCoreOption } from 'echarts/core';
import type { TreeSeriesOption } from 'echarts/charts';
import type {
  TreeSeriesCallbackDataParams,
  TreeSeriesNodeItemOption,
} from 'echarts/types/src/chart/tree/TreeSeries';
import type { OptionName } from 'echarts/types/src/util/types';
import {
  buildQueryContext,
  DataRecordValue,
  getMetricLabel,
  QueryFormData,
  tooltipHtml,
} from '@superset-ui/core';
import { sharedControls } from '@superset-ui/chart-controls';

import {
  defineChart,
  Metric,
  Text,
  Select,
  Int,
  RadioButton,
  ChartProps,
} from '@superset-ui/glyph-core';

import { getDefaultTooltip } from '../utils/tooltip';
import Echart from '../components/Echart';
import { Refs } from '../types';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/tree.png';
import exampleDark from './images/tree-dark.png';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TREE_SERIES_OPTION: Partial<TreeSeriesOption> = {
  label: {
    position: 'left',
    fontSize: 15,
  },
  animation: true,
  animationDuration: 500,
  animationEasing: 'cubicOut',
};

const DEFAULT_FORM_DATA = {
  layout: 'orthogonal',
  orient: 'LR',
  symbol: 'emptyCircle',
  symbolSize: 7,
  roam: true,
  nodeLabelPosition: 'left',
  childLabelPosition: 'bottom',
  emphasis: 'descendant',
  initialTreeDepth: 2,
};

const SYMBOL_OPTIONS = [
  { label: t('Empty circle'), value: 'emptyCircle' },
  { label: t('Circle'), value: 'circle' },
  { label: t('Rectangle'), value: 'rect' },
  { label: t('Triangle'), value: 'triangle' },
  { label: t('Diamond'), value: 'diamond' },
  { label: t('Pin'), value: 'pin' },
  { label: t('Arrow'), value: 'arrow' },
  { label: t('None'), value: 'none' },
];

const ROAM_OPTIONS = [
  { label: t('Disabled'), value: 'false' },
  { label: t('Scale only'), value: 'scale' },
  { label: t('Move only'), value: 'move' },
  { label: t('Scale and Move'), value: 'true' },
];

const LAYOUT_OPTIONS = [
  { label: t('Orthogonal'), value: 'orthogonal' },
  { label: t('Radial'), value: 'radial' },
];

const ORIENT_OPTIONS = [
  { label: t('Left to Right'), value: 'LR' },
  { label: t('Right to Left'), value: 'RL' },
  { label: t('Top to Bottom'), value: 'TB' },
  { label: t('Bottom to Top'), value: 'BT' },
];

const POSITION_OPTIONS = [
  { label: t('left'), value: 'left' },
  { label: t('top'), value: 'top' },
  { label: t('right'), value: 'right' },
  { label: t('bottom'), value: 'bottom' },
];

const EMPHASIS_OPTIONS = [
  { label: t('ancestor'), value: 'ancestor' },
  { label: t('descendant'), value: 'descendant' },
];

// ============================================================================
// Types
// ============================================================================

type TreeDataRecord = Record<string, OptionName> & {
  children?: TreeSeriesNodeItemOption[];
};

interface TreeTransformResult {
  transformedProps: {
    refs: Refs;
    width: number;
    height: number;
    echartOptions: EChartsCoreOption;
    formData: Record<string, unknown>;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTooltip({
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
  const row = value ? [metricLabel, String(value)] : [];
  return tooltipHtml([row], treePath.join(' ▸ '));
}

// ============================================================================
// Build Query
// ============================================================================

export function buildQuery(formData: QueryFormData) {
  return buildQueryContext(formData, {
    queryFields: {
      id: 'columns',
      parent: 'columns',
      name: 'columns',
    },
  });
}

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Tree Chart'),
    description: t(
      'Visualize multiple levels of hierarchy using a familiar tree-like structure.',
    ),
    category: t('Part of a Whole'),
    tags: [
      t('Categorical'),
      t('ECharts'),
      t('Multi-Levels'),
      t('Relational'),
      t('Structural'),
      t('Featured'),
    ],
    credits: ['https://echarts.apache.org'],
    thumbnail,
    thumbnailDark,
    exampleGallery: [{ url: example, urlDark: exampleDark }],
  },

  arguments: {
    // Chart Options
    layout: RadioButton.with({
      label: t('Tree layout'),
      description: t('Layout type of tree'),
      options: LAYOUT_OPTIONS,
      default: DEFAULT_FORM_DATA.layout,
    }),

    orient: {
      arg: RadioButton.with({
        label: t('Tree orientation'),
        description: t('Orientation of tree'),
        options: ORIENT_OPTIONS,
        default: DEFAULT_FORM_DATA.orient,
      }),
      visibleWhen: { layout: 'orthogonal' },
    },

    nodeLabelPosition: RadioButton.with({
      label: t('Node label position'),
      description: t('Position of intermediate node label on tree'),
      options: POSITION_OPTIONS,
      default: DEFAULT_FORM_DATA.nodeLabelPosition,
    }),

    childLabelPosition: RadioButton.with({
      label: t('Child label position'),
      description: t('Position of child node label on tree'),
      options: POSITION_OPTIONS,
      default: DEFAULT_FORM_DATA.childLabelPosition,
    }),

    emphasis: {
      arg: RadioButton.with({
        label: t('Emphasis'),
        description: t('Which relatives to highlight on hover'),
        options: EMPHASIS_OPTIONS,
        default: DEFAULT_FORM_DATA.emphasis,
      }),
      visibleWhen: { layout: 'orthogonal' },
    },

    symbol: Select.with({
      label: t('Symbol'),
      description: t('Shape of node symbol'),
      options: SYMBOL_OPTIONS,
      default: DEFAULT_FORM_DATA.symbol,
    }),

    symbolSize: Int.with({
      label: t('Symbol size'),
      description: t('Size of edge symbols'),
      default: DEFAULT_FORM_DATA.symbolSize,
      min: 5,
      max: 30,
      step: 2,
    }),

    roam: Select.with({
      label: t('Enable graph roaming'),
      description: t('Whether to enable changing graph position and scaling.'),
      options: ROAM_OPTIONS,
      default: 'true',
    }),

    initialTreeDepth: Int.with({
      label: t('Initial tree depth'),
      description: t(
        'The initial level (depth) of the tree. If set as -1 all nodes are expanded.',
      ),
      default: DEFAULT_FORM_DATA.initialTreeDepth,
      min: -1,
      max: 10,
      step: 1,
    }),

    // Metric for node values
    metric: Metric.with({
      label: t('Metric'),
      description: t('Metric for node values'),
      multi: false,
    }),

    rootNodeId: Text.with({
      label: t('Root node id'),
      description: t('Id of root node of the tree.'),
      default: '',
    }),
  },

  // Entity controls need special handling
  additionalControls: {
    query: [
      [
        {
          name: 'id',
          config: {
            ...sharedControls.entity,
            clearable: false,
            label: t('Id'),
            description: t('Name of the id column'),
          },
        },
      ],
      [
        {
          name: 'parent',
          config: {
            ...sharedControls.entity,
            clearable: false,
            label: t('Parent'),
            description: t(
              'Name of the column containing the id of the parent node',
            ),
          },
        },
      ],
      [
        {
          name: 'name',
          config: {
            ...sharedControls.entity,
            clearable: true,
            validators: [],
            label: t('Name'),
            description: t('Optional name of the data column.'),
          },
        },
      ],
    ],
  },

  buildQuery,

  transform: (chartProps: ChartProps): TreeTransformResult => {
    const { height, width, queriesData, rawFormData, theme } = chartProps;

    const refs: Refs = {};
    const data: TreeDataRecord[] =
      (queriesData[0]?.data as TreeDataRecord[]) || [];

    // Extract form values
    const id = rawFormData.id as string;
    const parent = rawFormData.parent as string;
    const name = rawFormData.name as string;
    const metric = (rawFormData.metric as string) || '';
    const rootNodeId = rawFormData.root_node_id as string | undefined;
    const layout = (rawFormData.layout as string) || DEFAULT_FORM_DATA.layout;
    const orient = (rawFormData.orient as string) || DEFAULT_FORM_DATA.orient;
    const symbol = (rawFormData.symbol as string) || DEFAULT_FORM_DATA.symbol;
    const symbolSize =
      (rawFormData.symbol_size as number) || DEFAULT_FORM_DATA.symbolSize;
    const roamValue = rawFormData.roam as string | boolean;
    const nodeLabelPosition =
      (rawFormData.node_label_position as string) ||
      DEFAULT_FORM_DATA.nodeLabelPosition;
    const childLabelPosition =
      (rawFormData.child_label_position as string) ||
      DEFAULT_FORM_DATA.childLabelPosition;
    const emphasis =
      (rawFormData.emphasis as string) || DEFAULT_FORM_DATA.emphasis;
    const initialTreeDepth =
      (rawFormData.initial_tree_depth as number) ??
      DEFAULT_FORM_DATA.initialTreeDepth;

    // Parse roam value
    let roam: boolean | 'scale' | 'move' = true;
    if (roamValue === 'false' || roamValue === false) {
      roam = false;
    } else if (roamValue === 'scale') {
      roam = 'scale';
    } else if (roamValue === 'move') {
      roam = 'move';
    } else {
      roam = true;
    }

    const metricLabel = getMetricLabel(metric);
    const nameColumn = name || id;

    function findNodeName(nodeId: DataRecordValue): OptionName {
      let nodeName: DataRecordValue = '';
      data.some(node => {
        if (node[id]?.toString() === nodeId) {
          nodeName = node[nameColumn];
          return true;
        }
        return false;
      });
      return nodeName;
    }

    function getTotalChildren(tree: TreeSeriesNodeItemOption): number {
      let totalChildren = 0;
      function traverse(node: TreeSeriesNodeItemOption) {
        (node.children || []).forEach(child => {
          traverse(child);
        });
        totalChildren += 1;
      }
      traverse(tree);
      return totalChildren;
    }

    function createTree(nodeId: DataRecordValue): TreeSeriesNodeItemOption {
      const rootNodeName = findNodeName(nodeId);
      const tree: TreeSeriesNodeItemOption = {
        name: rootNodeName,
        children: [],
      };
      const children: TreeSeriesNodeItemOption[][] = [];
      const indexMap: { [name: string]: number } = {};

      if (!rootNodeName) {
        return tree;
      }

      // Index map with node ids
      for (let i = 0; i < data.length; i += 1) {
        const nodeIdVal = data[i][id] as number;
        indexMap[nodeIdVal] = i;
        children[i] = [];
      }

      // Generate tree
      for (let i = 0; i < data.length; i += 1) {
        const node = data[i];
        if (node[parent]?.toString() === nodeId) {
          tree.children?.push({
            name: node[nameColumn],
            children: children[i],
            value: node[metricLabel],
          });
        } else {
          const parentId = node[parent];
          if (data[indexMap[parentId as string]]) {
            const parentIndex = indexMap[parentId as string];
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

    let finalTree: TreeSeriesNodeItemOption = { name: '', children: [] };

    if (rootNodeId) {
      finalTree = createTree(rootNodeId);
    } else {
      // Auto-select root node
      const parentChildMap: { [name: string]: { id: unknown }[] } = {};
      data.forEach(node => {
        const parentId = node[parent] as string;
        if (parentId in parentChildMap) {
          parentChildMap[parentId].push({ id: node[id] });
        } else {
          parentChildMap[parentId] = [{ id: node[id] }];
        }
      });

      let maxChildren = 0;
      Object.keys(parentChildMap).forEach(key => {
        if (parentChildMap[key].length === 1) {
          const tree = createTree(parentChildMap[key][0].id as string);
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
          position: nodeLabelPosition as 'left' | 'right' | 'top' | 'bottom',
          color: theme.colorText,
        },
        emphasis: { focus: emphasis as 'ancestor' | 'descendant' },
        animation: DEFAULT_TREE_SERIES_OPTION.animation,
        layout: layout as 'orthogonal' | 'radial',
        orient: orient as 'LR' | 'RL' | 'TB' | 'BT',
        symbol,
        roam,
        symbolSize,
        lineStyle: {
          color: theme.colorText,
          width: 1.5,
        },
        select: {
          itemStyle: {
            borderColor: theme.colorText,
          },
        },
        leaves: {
          label: {
            position: childLabelPosition as 'left' | 'right' | 'top' | 'bottom',
          },
        },
        initialTreeDepth,
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
        formatter: (params: unknown) =>
          formatTooltip({
            params: params as TreeSeriesCallbackDataParams,
            metricLabel,
          }),
      },
    };

    return {
      transformedProps: {
        refs,
        height,
        width,
        echartOptions,
        formData: rawFormData,
      },
    };
  },

  render: ({ transformedProps }) => {
    const { height, width, echartOptions, refs, formData } = transformedProps;

    return (
      <Echart
        refs={refs}
        height={height}
        width={width}
        echartOptions={echartOptions}
        vizType={formData.vizType as string}
      />
    );
  },
});

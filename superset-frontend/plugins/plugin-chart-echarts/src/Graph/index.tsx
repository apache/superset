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
 * ECharts Graph Chart - Glyph Pattern Implementation
 *
 * Displays connections between entities in a graph structure.
 * Useful for mapping relationships and showing which nodes are important in a network.
 * Graph charts can be configured to be force-directed or circular.
 */

import { t } from '@apache-superset/core/translation';
import type { EChartsCoreOption } from 'echarts/core';
import type { GraphSeriesOption } from 'echarts/charts';
import type {
  GraphEdgeItemOption,
  GraphNodeItemOption,
} from 'echarts/types/src/chart/graph/GraphSeries';
import type { SeriesTooltipOption } from 'echarts/types/src/util/types';
import { extent as d3Extent } from 'd3-array';
import {
  Behavior,
  buildQueryContext,
  CategoricalColorNamespace,
  DataRecord,
  DataRecordValue,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  QueryFormData,
  SetDataMaskHook,
  ContextMenuFilters,
  FilterState,
  tooltipHtml,
} from '@superset-ui/core';
import {
  getStandardizedControls,
  sharedControls,
} from '@superset-ui/chart-controls';

import {
  defineChart,
  Select,
  Checkbox,
  Text,
  Slider,
  RadioButton,
  ChartProps,
} from '@superset-ui/glyph-core';

import {
  getChartPadding,
  getColtypesMapping,
  getLegendProps,
  sanitizeHtml,
  formatSeriesName,
} from '../utils/series';
import { getDefaultTooltip } from '../utils/tooltip';
import { legendSection } from '../controls';
import { DEFAULT_LEGEND_FORM_DATA } from '../constants';
import Echart from '../components/Echart';
import { EventHandlers, LegendOrientation, LegendType, Refs } from '../types';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.jpg';
import exampleDark from './images/example-dark.jpg';

// ============================================================================
// Types
// ============================================================================

type EdgeSymbol = 'none' | 'circle' | 'arrow';

type EChartGraphNode = Omit<GraphNodeItemOption, 'value'> & {
  value: number;
  col: string;
  tooltip?: Pick<SeriesTooltipOption, 'formatter'>;
};

type EdgeWithStyles = GraphEdgeItemOption & {
  lineStyle: Exclude<GraphEdgeItemOption['lineStyle'], undefined>;
  emphasis: Exclude<GraphEdgeItemOption['emphasis'], undefined>;
  select: Exclude<GraphEdgeItemOption['select'], undefined>;
};

const DEFAULT_FORM_DATA = {
  ...DEFAULT_LEGEND_FORM_DATA,
  source: '',
  target: '',
  layout: 'force',
  roam: true,
  draggable: false,
  selectedMode: 'single',
  showSymbolThreshold: 0,
  repulsion: 1000,
  gravity: 0.3,
  edgeSymbol: 'none,arrow',
  edgeLength: 400,
  baseEdgeWidth: 3,
  baseNodeSize: 20,
  friction: 0.2,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
};

interface GraphTransformResult {
  transformedProps: {
    refs: Refs;
    width: number;
    height: number;
    echartOptions: EChartsCoreOption;
    formData: Record<string, unknown>;
    setDataMask: SetDataMaskHook;
    filterState?: FilterState;
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

const DEFAULT_GRAPH_SERIES_OPTION: GraphSeriesOption = {
  zoom: 0.7,
  circular: { rotateLabel: true },
  force: {
    initLayout: 'circular',
    layoutAnimation: true,
  },
  label: {
    show: true,
    position: 'right',
    distance: 5,
    rotate: 0,
    offset: [0, 0],
    fontStyle: 'normal',
    fontWeight: 'normal',
    fontFamily: 'sans-serif',
    fontSize: 12,
    padding: [0, 0, 0, 0],
    overflow: 'truncate',
    formatter: '{b}',
  },
  emphasis: {
    focus: 'adjacency',
  },
  animation: true,
  animationDuration: 500,
  animationEasing: 'cubicOut',
  lineStyle: { color: 'source', curveness: 0.1 },
  select: {
    itemStyle: { borderWidth: 3, opacity: 1 },
    label: { fontWeight: 'bolder' },
  },
  tooltip: { formatter: '{b}: {c}' },
};

// ============================================================================
// Helpers
// ============================================================================

function verifyEdgeSymbol(symbol: string): EdgeSymbol {
  if (symbol === 'none' || symbol === 'circle' || symbol === 'arrow') {
    return symbol;
  }
  return 'none';
}

function parseEdgeSymbol(symbols?: string | null): [EdgeSymbol, EdgeSymbol] {
  const [start, end] = (symbols || '').split(',');
  return [verifyEdgeSymbol(start), verifyEdgeSymbol(end)];
}

function getEmphasizedEdgeWidth(width: number) {
  return Math.max(5, Math.min(width * 2, 20));
}

function normalizeStyles(
  nodes: EChartGraphNode[],
  links: EdgeWithStyles[],
  {
    baseNodeSize,
    baseEdgeWidth,
    showSymbolThreshold,
  }: {
    baseNodeSize: number;
    baseEdgeWidth: number;
    showSymbolThreshold?: number;
  },
) {
  const minNodeSize = baseNodeSize * 0.5;
  const maxNodeSize = baseNodeSize * 2;
  const minEdgeWidth = baseEdgeWidth * 0.5;
  const maxEdgeWidth = baseEdgeWidth * 2;
  const [nodeMinValue, nodeMaxValue] = d3Extent(nodes, x => x.value) as [
    number,
    number,
  ];

  const nodeSpread = nodeMaxValue - nodeMinValue;
  nodes.forEach(node => {
    node.symbolSize =
      (((node.value - nodeMinValue) / nodeSpread) * maxNodeSize || 0) +
      minNodeSize;
    node.label = {
      ...node.label,
      show: showSymbolThreshold ? node.value > showSymbolThreshold : true,
    };
  });

  const [linkMinValue, linkMaxValue] = d3Extent(links, x => x.value) as [
    number,
    number,
  ];
  const linkSpread = linkMaxValue - linkMinValue;
  links.forEach(link => {
    const lineWidth =
      ((link.value! - linkMinValue) / linkSpread) * maxEdgeWidth ||
      0 + minEdgeWidth;
    link.lineStyle.width = lineWidth;
    link.emphasis.lineStyle = {
      ...link.emphasis.lineStyle,
      width: getEmphasizedEdgeWidth(lineWidth),
    };
    link.select.lineStyle = {
      ...link.select.lineStyle,
      width: getEmphasizedEdgeWidth(lineWidth * 0.8),
      opacity: 1,
    };
  });
}

function getKeyByValue(
  object: { [name: string]: number },
  value: number,
): string {
  return Object.keys(object).find(key => object[key] === value) as string;
}

function getCategoryName(columnName: string, name?: DataRecordValue) {
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

// ============================================================================
// Build Query
// ============================================================================

export function buildQuery(formData: QueryFormData) {
  return buildQueryContext(formData, {
    queryFields: {
      source: 'columns',
      target: 'columns',
      source_category: 'columns',
      target_category: 'columns',
    },
  });
}

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Graph Chart'),
    description: t(
      'Displays connections between entities in a graph structure. Useful for mapping relationships and showing which nodes are important in a network. Graph charts can be configured to be force-directed or circulate. If your data has a geospatial component, try the deck.gl Arc chart.',
    ),
    category: t('Flow'),
    tags: [
      t('Circular'),
      t('Comparison'),
      t('Directional'),
      t('ECharts'),
      t('Relational'),
      t('Structural'),
      t('Transformable'),
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
    exampleGallery: [{ url: example, urlDark: exampleDark }],
  },

  arguments: {
    layout: RadioButton.with({
      label: t('Graph layout'),
      description: t('Layout type of graph'),
      options: [
        { label: t('Force'), value: 'force' },
        { label: t('Circular'), value: 'circular' },
      ],
      default: 'force',
    }),

    edgeSymbol: Select.with({
      label: t('Edge symbols'),
      description: t('Symbol of two ends of edge line'),
      options: [
        { label: t('None -> None'), value: 'none,none' },
        { label: t('None -> Arrow'), value: 'none,arrow' },
        { label: t('Circle -> Arrow'), value: 'circle,arrow' },
        { label: t('Circle -> Circle'), value: 'circle,circle' },
      ],
      default: 'none,arrow',
    }),

    draggable: {
      arg: Checkbox.with({
        label: t('Enable node dragging'),
        description: t('Whether to enable node dragging in force layout mode.'),
        default: false,
      }),
      visibleWhen: { layout: 'force' },
    },

    roam: Select.with({
      label: t('Enable graph roaming'),
      description: t('Whether to enable changing graph position and scaling.'),
      options: [
        { label: t('Disabled'), value: 'false' },
        { label: t('Scale only'), value: 'scale' },
        { label: t('Move only'), value: 'move' },
        { label: t('Scale and Move'), value: 'true' },
      ],
      default: 'true',
    }),

    selectedMode: Select.with({
      label: t('Node select mode'),
      description: t('Allow node selections'),
      options: [
        { label: t('Disabled'), value: 'false' },
        { label: t('Single'), value: 'single' },
        { label: t('Multiple'), value: 'multiple' },
      ],
      default: 'single',
    }),

    showSymbolThreshold: Text.with({
      label: t('Label threshold'),
      description: t('Minimum value for label to be displayed on graph.'),
      default: '0',
    }),

    baseNodeSize: Text.with({
      label: t('Node size'),
      description: t(
        'Median node size, the largest node will be 4 times larger than the smallest',
      ),
      default: '20',
    }),

    baseEdgeWidth: Text.with({
      label: t('Edge width'),
      description: t(
        'Median edge width, the thickest edge will be 4 times thicker than the thinnest.',
      ),
      default: '3',
    }),

    edgeLength: {
      arg: Slider.with({
        label: t('Edge length'),
        description: t('Edge length between nodes'),
        min: 100,
        max: 1000,
        step: 50,
        default: 400,
      }),
      visibleWhen: { layout: 'force' },
    },

    gravity: {
      arg: Slider.with({
        label: t('Gravity'),
        description: t('Strength to pull the graph toward center'),
        min: 0.1,
        max: 1,
        step: 0.1,
        default: 0.3,
      }),
      visibleWhen: { layout: 'force' },
    },

    repulsion: {
      arg: Slider.with({
        label: t('Repulsion'),
        description: t('Repulsion strength between nodes'),
        min: 100,
        max: 3000,
        step: 50,
        default: 1000,
      }),
      visibleWhen: { layout: 'force' },
    },

    friction: {
      arg: Slider.with({
        label: t('Friction'),
        description: t('Friction between nodes'),
        min: 0.1,
        max: 1,
        step: 0.1,
        default: 0.2,
      }),
      visibleWhen: { layout: 'force' },
    },
  },

  additionalControls: {
    query: [
      [
        {
          name: 'source',
          config: {
            ...sharedControls.entity,
            clearable: false,
            label: t('Source'),
            description: t('Name of the source nodes'),
          },
        },
      ],
      [
        {
          name: 'target',
          config: {
            ...sharedControls.entity,
            clearable: false,
            label: t('Target'),
            description: t('Name of the target nodes'),
          },
        },
      ],
      ['metric'],
      [
        {
          name: 'source_category',
          config: {
            ...sharedControls.entity,
            clearable: true,
            validators: [],
            label: t('Source category'),
            description: t(
              'The category of source nodes used to assign colors. If a node is associated with more than one category, only the first will be used.',
            ),
          },
        },
      ],
      [
        {
          name: 'target_category',
          config: {
            ...sharedControls.entity,
            clearable: true,
            validators: [],
            label: t('Target category'),
            description: t('Category of target nodes'),
          },
        },
      ],
      ['adhoc_filters'],
      ['row_limit'],
    ],
    chartOptions: [['color_scheme'], ...legendSection],
  },

  formDataOverrides: (formData: QueryFormData) => ({
    ...formData,
    metric: getStandardizedControls().popAllMetrics(),
  }),

  buildQuery,

  transform: (chartProps: ChartProps): GraphTransformResult => {
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
    } = chartProps;

    const data: DataRecord[] = queriesData[0].data || [];
    const coltypeMapping = getColtypesMapping(
      queriesData[0] as unknown as Parameters<typeof getColtypesMapping>[0],
    );
    const { setDataMask = () => {}, onContextMenu } = hooks ?? {};
    const refs: Refs = {};

    // Extract form values with defaults
    const source = (rawFormData.source as string) || DEFAULT_FORM_DATA.source;
    const target = (rawFormData.target as string) || DEFAULT_FORM_DATA.target;
    const sourceCategory = rawFormData.source_category as string | undefined;
    const targetCategory = rawFormData.target_category as string | undefined;
    const colorScheme = rawFormData.color_scheme as string;
    const metric = (rawFormData.metric as string) || '';
    const layout =
      (rawFormData.layout as 'force' | 'circular') || DEFAULT_FORM_DATA.layout;

    // Handle roam - can be boolean or string
    let { roam } = DEFAULT_FORM_DATA;
    const roamValue = rawFormData.roam;
    if (roamValue === 'true' || roamValue === true) roam = true;
    else if (roamValue === 'false' || roamValue === false) roam = false;
    else if (roamValue === 'scale' || roamValue === 'move') roam = roamValue;

    const draggable =
      rawFormData.draggable !== undefined
        ? (rawFormData.draggable as boolean)
        : DEFAULT_FORM_DATA.draggable;

    // Handle selectedMode - can be boolean or string
    let selectedMode: boolean | 'single' | 'multiple' =
      DEFAULT_FORM_DATA.selectedMode as 'single';
    const selectedModeValue = rawFormData.selected_mode;
    if (selectedModeValue === 'false' || selectedModeValue === false)
      selectedMode = false;
    else if (selectedModeValue === 'single' || selectedModeValue === 'multiple')
      selectedMode = selectedModeValue;

    const showSymbolThreshold = parseInt(
      (rawFormData.show_symbol_threshold as string) ||
        String(DEFAULT_FORM_DATA.showSymbolThreshold),
      10,
    );
    const edgeLength =
      (rawFormData.edge_length as number) || DEFAULT_FORM_DATA.edgeLength;
    const gravity =
      (rawFormData.gravity as number) || DEFAULT_FORM_DATA.gravity;
    const repulsion =
      (rawFormData.repulsion as number) || DEFAULT_FORM_DATA.repulsion;
    const friction =
      (rawFormData.friction as number) || DEFAULT_FORM_DATA.friction;
    const legendMargin = rawFormData.legend_margin as number | undefined;
    const legendOrientation =
      (rawFormData.legend_orientation as LegendOrientation) ||
      DEFAULT_FORM_DATA.legendOrientation;
    const legendType =
      (rawFormData.legend_type as LegendType) || DEFAULT_FORM_DATA.legendType;
    const legendSort = rawFormData.legend_sort as string | undefined;
    const showLegend =
      rawFormData.show_legend !== undefined
        ? (rawFormData.show_legend as boolean)
        : DEFAULT_FORM_DATA.showLegend;
    const baseEdgeWidth = parseFloat(
      (rawFormData.base_edge_width as string) ||
        String(DEFAULT_FORM_DATA.baseEdgeWidth),
    );
    const baseNodeSize = parseFloat(
      (rawFormData.base_node_size as string) ||
        String(DEFAULT_FORM_DATA.baseNodeSize),
    );
    const edgeSymbol =
      (rawFormData.edge_symbol as string) || DEFAULT_FORM_DATA.edgeSymbol;
    const sliceId = rawFormData.slice_id as number | undefined;

    const metricLabel = getMetricLabel(metric);
    const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
    const firstColor = colorFn.range()[0];
    const nodes: { [name: string]: number } = {};
    const categories: Set<string> = new Set();
    const echartNodes: EChartGraphNode[] = [];
    const echartLinks: EdgeWithStyles[] = [];

    function getOrCreateNode(
      name: string,
      col: string,
      category?: string,
      color?: string,
    ) {
      if (!(name in nodes)) {
        nodes[name] = echartNodes.length;
        echartNodes.push({
          id: String(nodes[name]),
          name,
          col,
          value: 0,
          category,
          select: DEFAULT_GRAPH_SERIES_OPTION.select,
          tooltip: {
            ...getDefaultTooltip(refs),
            ...DEFAULT_GRAPH_SERIES_OPTION.tooltip,
          },
          itemStyle: { color },
        });
      }
      const node = echartNodes[nodes[name]];
      if (category) {
        categories.add(category);
        if (!node.category) {
          node.category = category;
        }
      }
      return node;
    }

    data.forEach(link => {
      const value = link[metricLabel] as number;
      if (!value) {
        return;
      }
      const sourceName = link[source] as string;
      const targetName = link[target] as string;
      const sourceCategoryName = sourceCategory
        ? getCategoryName(sourceCategory, link[sourceCategory])
        : undefined;
      const targetCategoryName = targetCategory
        ? getCategoryName(targetCategory, link[targetCategory])
        : undefined;
      const sourceNodeColor = sourceCategoryName
        ? colorFn(sourceCategoryName)
        : firstColor;
      const targetNodeColor = targetCategoryName
        ? colorFn(targetCategoryName)
        : firstColor;

      const sourceNode = getOrCreateNode(
        sourceName,
        source,
        sourceCategoryName,
        sourceNodeColor,
      );
      const targetNode = getOrCreateNode(
        targetName,
        target,
        targetCategoryName,
        targetNodeColor,
      );

      sourceNode.value += value;
      targetNode.value += value;

      echartLinks.push({
        source: sourceNode.id,
        target: targetNode.id,
        value,
        lineStyle: {
          color: sourceNodeColor,
        },
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
    const series: GraphSeriesOption[] = [
      {
        zoom: DEFAULT_GRAPH_SERIES_OPTION.zoom,
        type: 'graph',
        categories: categoryList.map(c => ({
          name: c,
          itemStyle: {
            color: colorFn(c, sliceId),
          },
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
        label: {
          ...DEFAULT_GRAPH_SERIES_OPTION.label,
          color: theme.colorText,
        },
        lineStyle: DEFAULT_GRAPH_SERIES_OPTION.lineStyle,
        emphasis: DEFAULT_GRAPH_SERIES_OPTION.emphasis,
      },
    ];

    const echartOptions: EChartsCoreOption = {
      animationDuration: DEFAULT_GRAPH_SERIES_OPTION.animationDuration,
      animationEasing: DEFAULT_GRAPH_SERIES_OPTION.animationEasing,
      tooltip: {
        ...getDefaultTooltip(refs),
        show: !inContextMenu,
        formatter: (params: {
          data: { source: string; target: string };
          value: number;
        }): string => {
          const sourceLabel = sanitizeHtml(
            getKeyByValue(nodes, Number(params.data.source)),
          );
          const targetLabel = sanitizeHtml(
            getKeyByValue(nodes, Number(params.data.target)),
          );
          const title = `${sourceLabel} > ${targetLabel}`;
          return tooltipHtml([[metricLabel, `${params.value}`]], title);
        },
      },
      legend: {
        ...getLegendProps(legendType, legendOrientation, showLegend, theme),
        data: categoryList.sort((a: string, b: string) => {
          if (!legendSort) return 0;
          return legendSort === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
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
        setDataMask,
        filterState,
        emitCrossFilters,
        onContextMenu,
        coltypeMapping,
      },
    };
  },

  render: ({ transformedProps }) => {
    const {
      height,
      width,
      echartOptions,
      formData,
      onContextMenu,
      setDataMask,
      filterState,
      emitCrossFilters,
      refs,
      coltypeMapping,
    } = transformedProps;

    type DataRow = {
      source?: string;
      target?: string;
      id?: string;
      col: string;
      name: string;
    };
    type Data = DataRow[];
    type Event = {
      name: string;
      event: { stop: () => void; event: PointerEvent };
      data: DataRow;
      dataType: 'node' | 'edge';
    };

    const getCrossFilterDataMask = (node: DataRow | undefined) => {
      if (!node?.name || !node?.col) {
        return undefined;
      }
      const { name, col } = node;
      const selected = Object.values(
        filterState?.selectedValues || {},
      ) as string[];
      let values: string[];
      if (selected.includes(name)) {
        values = selected.filter(v => v !== name);
      } else {
        values = [name];
      }
      return {
        dataMask: {
          extraFormData: {
            filters: values.length
              ? [
                  {
                    col,
                    op: 'IN' as const,
                    val: values,
                  },
                ]
              : [],
          },
          filterState: {
            value: values.length ? values : null,
            selectedValues: values.length ? values : null,
          },
        },
        isCurrentValueSelected: selected.includes(name),
      };
    };

    const eventHandlers: EventHandlers = {
      click: (e: Event) => {
        if (!emitCrossFilters || !setDataMask) {
          return;
        }
        e.event.stop();
        const { data } = (echartOptions as { series: { data: Data }[] })
          .series[0];
        const node = data.find(item => item.id === e.data.id);
        const dataMask = getCrossFilterDataMask(node)?.dataMask;
        if (dataMask) {
          setDataMask(dataMask);
        }
      },
      contextmenu: (e: Event) => {
        const handleNodeClick = (data: Data) => {
          const node = data.find(item => item.id === e.data.id);
          if (node?.name) {
            return [
              {
                col: node.col,
                op: '==' as const,
                val: node.name,
                formattedVal: node.name,
              },
            ];
          }
          return undefined;
        };
        const handleEdgeClick = (data: Data) => {
          const sourceValue = data.find(
            item => item.id === e.data.source,
          )?.name;
          const targetValue = data.find(
            item => item.id === e.data.target,
          )?.name;
          if (sourceValue && targetValue) {
            return [
              {
                col: formData.source as string,
                op: '==' as const,
                val: sourceValue,
                formattedVal: sourceValue,
              },
              {
                col: formData.target as string,
                op: '==' as const,
                val: targetValue,
                formattedVal: targetValue,
              },
            ];
          }
          return undefined;
        };
        if (onContextMenu) {
          e.event.stop();
          const pointerEvent = e.event.event;
          const { data } = (echartOptions as { series: { data: Data }[] })
            .series[0];
          const drillToDetailFilters =
            e.dataType === 'node'
              ? handleNodeClick(data)
              : handleEdgeClick(data);
          const node = data.find(item => item.id === e.data.id);

          onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
            drillToDetail: drillToDetailFilters,
            crossFilter: getCrossFilterDataMask(node),
            drillBy: node && {
              filters: [
                {
                  col: node.col,
                  op: '==',
                  val: node.name,
                  formattedVal: formatSeriesName(node.name, {
                    timeFormatter: getTimeFormatter(
                      formData.date_format as string,
                    ),
                    numberFormatter: getNumberFormatter(
                      formData.number_format as string,
                    ),
                    coltype: coltypeMapping?.[getColumnLabel(node.col)],
                  }),
                },
              ],
              groupbyFieldName:
                node.col === formData.source ? 'source' : 'target',
            },
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
        vizType={formData.vizType as string}
      />
    );
  },
});

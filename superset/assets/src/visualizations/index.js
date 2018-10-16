/* eslint-disable global-require */

// You ***should*** use these to reference viz_types in code
export const VIZ_TYPES = {
  area: 'area',
  bar: 'bar',
  big_number: 'big_number',
  big_number_total: 'big_number_total',
  box_plot: 'box_plot',
  bubble: 'bubble',
  bullet: 'bullet',
  cal_heatmap: 'cal_heatmap',
  compare: 'compare',
  directed_force: 'directed_force',
  chord: 'chord',
  dist_bar: 'dist_bar',
  filter_box: 'filter_box',
  heatmap: 'heatmap',
  histogram: 'histogram',
  horizon: 'horizon',
  iframe: 'iframe',
  line: 'line',
  line_multi: 'line_multi',
  mapbox: 'mapbox',
  markup: 'markup',
  para: 'para',
  pie: 'pie',
  pivot_table: 'pivot_table',
  sankey: 'sankey',
  separator: 'separator',
  sunburst: 'sunburst',
  table: 'table',
  time_table: 'time_table',
  time_pivot: 'time_pivot',
  treemap: 'treemap',
  country_map: 'country_map',
  word_cloud: 'word_cloud',
  world_map: 'world_map',
  dual_line: 'dual_line',
  event_flow: 'event_flow',
  paired_ttest: 'paired_ttest',
  partition: 'partition',
  deck_scatter: 'deck_scatter',
  deck_screengrid: 'deck_screengrid',
  deck_grid: 'deck_grid',
  deck_hex: 'deck_hex',
  deck_path: 'deck_path',
  deck_geojson: 'deck_geojson',
  deck_multi: 'deck_multi',
  deck_arc: 'deck_arc',
  deck_polygon: 'deck_polygon',
  rose: 'rose',
};

const loadVis = promise =>
  promise.then((module) => {
    const defaultExport = module.default || module;

    // deckgl visualizations don't use esModules, fix it?
    return defaultExport.default || defaultExport;
  });
const loadNvd3 = () => loadVis(import(/* webpackChunkName: "nvd3_vis" */ './nvd3/adaptor.jsx'));

const vizMap = {
  [VIZ_TYPES.area]: loadNvd3,
  [VIZ_TYPES.bar]: loadNvd3,
  [VIZ_TYPES.big_number]: () =>
    loadVis(import(/* webpackChunkName: 'big_number' */ './BigNumber/adaptor.jsx')),
  [VIZ_TYPES.big_number_total]: () =>
    loadVis(import(/* webpackChunkName: "big_number" */ './BigNumber/adaptor.jsx')),
  [VIZ_TYPES.box_plot]: loadNvd3,
  [VIZ_TYPES.bubble]: loadNvd3,
  [VIZ_TYPES.bullet]: loadNvd3,
  [VIZ_TYPES.cal_heatmap]: () =>
    loadVis(import(/* webpackChunkName: "cal_heatmap" */ './Calendar/adaptor.jsx')),
  [VIZ_TYPES.compare]: loadNvd3,
  [VIZ_TYPES.directed_force]: () =>
    loadVis(import(/* webpackChunkName: "directed_force" */ './ForceDirected/adaptor.jsx')),
  [VIZ_TYPES.chord]: () => loadVis(import(/* webpackChunkName: "chord" */ './Chord/adaptor.jsx')),
  [VIZ_TYPES.dist_bar]: loadNvd3,
  [VIZ_TYPES.filter_box]: () =>
    loadVis(import(/* webpackChunkName: "filter_box" */ './FilterBox/adaptor.jsx')),
  [VIZ_TYPES.heatmap]: () => loadVis(import(/* webpackChunkName: "heatmap" */ './Heatmap/adaptor.jsx')),
  [VIZ_TYPES.histogram]: () =>
    loadVis(import(/* webpackChunkName: "histogram" */ './Histogram/adaptor.jsx')),
  [VIZ_TYPES.horizon]: () => loadVis(import(/* webpackChunkName: "horizon" */ './Horizon/adaptor.jsx')),
  [VIZ_TYPES.iframe]: () => loadVis(import(/* webpackChunkName: "iframe" */ './iframe.js')),
  [VIZ_TYPES.line]: loadNvd3,
  [VIZ_TYPES.line_multi]: () =>
    loadVis(import(/* webpackChunkName: "line_multi" */ './nvd3/LineMulti.js')),
  [VIZ_TYPES.time_pivot]: loadNvd3,
  [VIZ_TYPES.mapbox]: () => loadVis(import(/* webpackChunkName: "mapbox" */ './MapBox/adaptor.jsx')),
  [VIZ_TYPES.markup]: () => loadVis(import(/* webpackChunkName: "markup" */ './markup.js')),
  [VIZ_TYPES.para]: () =>
    loadVis(import(/* webpackChunkName: "parallel_coordinates" */ './ParallelCoordinates/adaptor.jsx')),
  [VIZ_TYPES.pie]: loadNvd3,
  [VIZ_TYPES.pivot_table]: () =>
    loadVis(import(/* webpackChunkName: "pivot_table" */ './PivotTable/adaptor.jsx')),
  [VIZ_TYPES.sankey]: () => loadVis(import(/* webpackChunkName: "sankey" */ './Sankey/adaptor.jsx')),
  [VIZ_TYPES.separator]: () => loadVis(import(/* webpackChunkName: "markup" */ './markup.js')),
  [VIZ_TYPES.sunburst]: () => loadVis(import(/* webpackChunkName: "sunburst" */ './Sunburst/adaptor.jsx')),
  [VIZ_TYPES.table]: () => loadVis(import(/* webpackChunkName: "table" */ './Table/adaptor.jsx')),
  [VIZ_TYPES.time_table]: () =>
    loadVis(import(/* webpackChunkName: "time_table" */ './TimeTable/adaptor.jsx')),
  [VIZ_TYPES.treemap]: () => loadVis(import(/* webpackChunkName: "treemap" */ './Treemap/adaptor.jsx')),
  [VIZ_TYPES.country_map]: () =>
    loadVis(import(/* webpackChunkName: "country_map" */ './CountryMap/adaptor.jsx')),
  [VIZ_TYPES.word_cloud]: () =>
    loadVis(import(/* webpackChunkName: "word_cloud" */ './wordcloud/adaptor.jsx')),
  [VIZ_TYPES.world_map]: () =>
    loadVis(import(/* webpackChunkName: "world_map" */ './WorldMap/adaptor.jsx')),
  [VIZ_TYPES.dual_line]: loadNvd3,
  [VIZ_TYPES.event_flow]: () =>
    loadVis(import(/* webpackChunkName: "EventFlow" */ './EventFlow/adaptor.jsx')),
  [VIZ_TYPES.paired_ttest]: () =>
    loadVis(import(/* webpackChunkName: "paired_ttest" */ './PairedTTest/adaptor.jsx')),
  [VIZ_TYPES.partition]: () =>
    loadVis(import(/* webpackChunkName: "partition" */ './Partition/adaptor.jsx')),
  [VIZ_TYPES.deck_scatter]: () =>
    loadVis(import(/* webpackChunkName: "deckgl/layers/scatter" */ './deckgl/layers/Scatter/Scatter.jsx')),
  [VIZ_TYPES.deck_screengrid]: () =>
    loadVis(
      import(/* webpackChunkName: "deckgl/layers/screengrid" */ './deckgl/layers/Screengrid/Screengrid.jsx'),
    ),
  [VIZ_TYPES.deck_grid]: () =>
    loadVis(import(/* webpackChunkName: "deckgl/layers/grid" */ './deckgl/layers/Grid/Grid.jsx')),
  [VIZ_TYPES.deck_hex]: () =>
    loadVis(import(/* webpackChunkName: "deckgl/layers/hex" */ './deckgl/layers/Hex/Hex.jsx')),
  [VIZ_TYPES.deck_path]: () =>
    loadVis(import(/* webpackChunkName: "deckgl/layers/path" */ './deckgl/layers/Path/Path.jsx')),
  [VIZ_TYPES.deck_geojson]: () =>
    loadVis(import(/* webpackChunkName: "deckgl/layers/geojson" */ './deckgl/layers/Geojson/Geojson.jsx')),
  [VIZ_TYPES.deck_arc]: () =>
    loadVis(import(/* webpackChunkName: "deckgl/layers/arc" */ './deckgl/layers/Arc/Arc.jsx')),
  [VIZ_TYPES.deck_polygon]: () =>
    loadVis(import(/* webpackChunkName: "deckgl/layers/polygon" */ './deckgl/layers/Polygon/Polygon.jsx')),
  [VIZ_TYPES.deck_multi]: () =>
    loadVis(import(/* webpackChunkName: "deckgl/multi" */ './deckgl/Multi/Multi.jsx')),
  [VIZ_TYPES.rose]: () => loadVis(import(/* webpackChunkName: "rose" */ './Rose/adaptor.jsx')),
};

export default vizMap;

/**
 * This file defines how controls (defined in controls.js) are structured into sections
 * and associated with each and every visualization type.
 */
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import * as sections from './controlPanels/sections';

import Area from './controlPanels/Area';
import Bar from './controlPanels/Bar';
import BigNumber from './controlPanels/BigNumber';
import BigNumberTotal from './controlPanels/BigNumberTotal';
import BoxPlot from './controlPanels/BoxPlot';
import Bubble from './controlPanels/Bubble';
import Bullet from './controlPanels/Bullet';
import CalHeatmap from './controlPanels/CalHeatmap';
import Chord from './controlPanels/Chord';
import Compare from './controlPanels/Compare';
import CountryMap from './controlPanels/CountryMap';
import DirectedForce from './controlPanels/DirectedForce';
import DistBar from './controlPanels/DistBar';
import DualLine from './controlPanels/DualLine';
import EventFlow from './controlPanels/EventFlow';
import FilterBox from './controlPanels/FilterBox';
import Heatmap from './controlPanels/Heatmap';
import Histogram from './controlPanels/Histogram';
import Horizon from './controlPanels/Horizon';
import Iframe from './controlPanels/Iframe';
import Line from './controlPanels/Line';
import LineMulti from './controlPanels/LineMulti';
import Mapbox from './controlPanels/Mapbox';
import Markup from './controlPanels/Markup';
import PairedTtest from './controlPanels/PairedTtest';
import Para from './controlPanels/Para';
import Partition from './controlPanels/Partition';
import Pie from './controlPanels/Pie';
import PivotTable from './controlPanels/PivotTable';
import Rose from './controlPanels/Rose';
import Sankey from './controlPanels/Sankey';
import Sunburst from './controlPanels/Sunburst';
import Separator from './controlPanels/Separator';
import Table from './controlPanels/Table';
import TimePivot from './controlPanels/TimePivot';
import TimeTable from './controlPanels/TimeTable';
import Treemap from './controlPanels/Treemap';
import WordCloud from './controlPanels/WordCloud';
import WorldMap from './controlPanels/WorldMap';
import DeckArc from './controlPanels/DeckArc';
import DeckGeojson from './controlPanels/DeckGeojson';
import DeckGrid from './controlPanels/DeckGrid';
import DeckHex from './controlPanels/DeckHex';
import DeckMulti from './controlPanels/DeckMulti';
import DeckPath from './controlPanels/DeckPath';
import DeckPolygon from './controlPanels/DeckPolygon';
import DeckScatter from './controlPanels/DeckScatter';
import DeckScreengrid from './controlPanels/DeckScreengrid';

export const controlPanelConfigs = {
  area: Area,
  bar: Bar,
  big_number: BigNumber,
  big_number_total: BigNumberTotal,
  box_plot: BoxPlot,
  bubble: Bubble,
  bullet: Bullet,
  cal_heatmap: CalHeatmap,
  chord: Chord,
  compare: Compare,
  country_map: CountryMap,
  directed_force: DirectedForce,
  dist_bar: DistBar,
  dual_line: DualLine,
  event_flow: EventFlow,
  filter_box: FilterBox,
  heatmap: Heatmap,
  histogram: Histogram,
  horizon: Horizon,
  iframe: Iframe,
  line: Line,
  line_multi: LineMulti,
  mapbox: Mapbox,
  markup: Markup,
  paired_ttest: PairedTtest,
  para: Para,
  partition: Partition,
  pie: Pie,
  pivot_table: PivotTable,
  rose: Rose,
  sankey: Sankey,
  separator: Separator,
  sunburst: Sunburst,
  table: Table,
  time_pivot: TimePivot,
  time_table: TimeTable,
  treemap: Treemap,
  word_cloud: WordCloud,
  world_map: WorldMap,
  deck_arc: DeckArc,
  deck_geojson: DeckGeojson,
  deck_grid: DeckGrid,
  deck_hex: DeckHex,
  deck_multi: DeckMulti,
  deck_path: DeckPath,
  deck_polygon: DeckPolygon,
  deck_scatter: DeckScatter,
  deck_screengrid: DeckScreengrid,

};

export default controlPanelConfigs;

export function sectionsToRender(vizType, datasourceType) {
  const config = controlPanelConfigs[vizType];

  const sectionsCopy = { ...sections };
  if (config.sectionOverrides) {
    Object.entries(config.sectionOverrides).forEach(([section, overrides]) => {
      if (typeof overrides === 'object' && overrides.constructor === Object) {
        sectionsCopy[section] = {
          ...sectionsCopy[section],
          ...overrides,
        };
      } else {
        sectionsCopy[section] = overrides;
      }
    });
  }

  return [].concat(
    sectionsCopy.datasourceAndVizType,
    datasourceType === 'table' ? sectionsCopy.sqlaTimeSeries : sectionsCopy.druidTimeSeries,
    isFeatureEnabled(FeatureFlag.SCOPED_FILTER) ? sectionsCopy.filters : undefined,
    config.controlPanelSections,
  ).filter(section => section);
}

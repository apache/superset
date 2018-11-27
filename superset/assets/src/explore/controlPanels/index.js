/**
 * This file defines how controls (defined in controls.js) are structured into sections
 * and associated with each and every visualization type.
 */
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import * as sections from './sections';

import Area from './Area';
import Bar from './Bar';
import BigNumber from './BigNumber';
import BigNumberTotal from './BigNumberTotal';
import BoxPlot from './BoxPlot';
import Bubble from './Bubble';
import Bullet from './Bullet';
import CalHeatmap from './CalHeatmap';
import Chord from './Chord';
import Compare from './Compare';
import CountryMap from './CountryMap';
import DirectedForce from './DirectedForce';
import DistBar from './DistBar';
import DualLine from './DualLine';
import EventFlow from './EventFlow';
import FilterBox from './FilterBox';
import Heatmap from './Heatmap';
import Histogram from './Histogram';
import Horizon from './Horizon';
import Iframe from './Iframe';
import Line from './Line';
import LineMulti from './LineMulti';
import Mapbox from './Mapbox';
import Markup from './Markup';
import PairedTtest from './PairedTtest';
import Para from './Para';
import Partition from './Partition';
import Pie from './Pie';
import PivotTable from './PivotTable';
import Rose from './Rose';
import Sankey from './Sankey';
import Sunburst from './Sunburst';
import Separator from './Separator';
import Table from './Table';
import TimePivot from './TimePivot';
import TimeTable from './TimeTable';
import Treemap from './Treemap';
import WordCloud from './WordCloud';
import WorldMap from './WorldMap';
import DeckArc from './DeckArc';
import DeckGeojson from './DeckGeojson';
import DeckGrid from './DeckGrid';
import DeckHex from './DeckHex';
import DeckMulti from './DeckMulti';
import DeckPath from './DeckPath';
import DeckPolygon from './DeckPolygon';
import DeckScatter from './DeckScatter';
import DeckScreengrid from './DeckScreengrid';

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

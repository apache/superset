import Preset from '../core/models/Preset';
import AreaChartPlugin from '../nvd3/Area/AreaChartPlugin';
import BarChartPlugin from '../nvd3/Bar/BarChartPlugin';
import BigNumberChartPlugin from '../BigNumber/BigNumberChartPlugin';
import BigNumberTotalChartPlugin from '../BigNumberTotal/BigNumberTotalChartPlugin';
import BoxPlotChartPlugin from '../nvd3/BoxPlot/BoxPlotChartPlugin';
import BubbleChartPlugin from '../nvd3/Bubble/BubbleChartPlugin';
import BulletChartPlugin from '../nvd3/Bullet/BulletChartPlugin';
import CalendarChartPlugin from '../Calendar/CalendarChartPlugin';
import ChordChartPlugin from '../Chord/ChordChartPlugin';
import CompareChartPlugin from '../nvd3/Compare/CompareChartPlugin';
import CountryMapChartPlugin from '../CountryMap/CountryMapChartPlugin';
import DistBarChartPlugin from '../nvd3/DistBar/DistBarChartPlugin';
import DualLineChartPlugin from '../nvd3/DualLine/DualLineChartPlugin';
import EventFlowChartPlugin from '../EventFlow/EventFlowChartPlugin';
import FilterBoxChartPlugin from '../FilterBox/FilterBoxChartPlugin';
import ForceDirectedChartPlugin from '../ForceDirected/ForceDirectedChartPlugin';
import HeatmapChartPlugin from '../Heatmap/HeatmapChartPlugin';
import HistogramChartPlugin from '../Histogram/HistogramChartPlugin';
import HorizonChartPlugin from '../Horizon/HorizonChartPlugin';
import LineChartPlugin from '../nvd3/Line/LineChartPlugin';
import MapBoxChartPlugin from '../MapBox/MapBoxChartPlugin';
import PairedTTestChartPlugin from '../PairedTTest/PairedTTestChartPlugin';
import ParallelCoordinatesChartPlugin from '../ParallelCoordinates/ParallelCoordinatesChartPlugin';
import PartitionChartPlugin from '../Partition/PartitionChartPlugin';
import PieChartPlugin from '../nvd3/Pie/PieChartPlugin';
import PivotTableChartPlugin from '../PivotTable/PivotTableChartPlugin';
import RoseChartPlugin from '../Rose/RoseChartPlugin';
import SankeyChartPlugin from '../Sankey/SankeyChartPlugin';
import SunburstChartPlugin from '../Sunburst/SunburstChartPlugin';
import TableChartPlugin from '../Table/TableChartPlugin';
import TimeTableChartPlugin from '../TimeTable/TimeTableChartPlugin';
import TimePivotChartPlugin from '../nvd3/TimePivot/TimePivotChartPlugin';
import TreemapChartPlugin from '../Treemap/TreemapChartPlugin';
import WordCloudChartPlugin from '../wordcloud/WordCloudChartPlugin';
import WorldMapChartPlugin from '../WorldMap/WorldMapChartPlugin';

export default class ClassicChartPreset extends Preset {
  constructor() {
    super({
      name: 'Classic charts',
      plugins: [
        new AreaChartPlugin().configure({ key: 'area' }),
        new BarChartPlugin().configure({ key: 'bar' }),
        new BigNumberChartPlugin().configure({ key: 'big_number' }),
        new BigNumberTotalChartPlugin().configure({ key: 'big_number_total' }),
        new BoxPlotChartPlugin().configure({ key: 'box_plot' }),
        new BubbleChartPlugin().configure({ key: 'bubble' }),
        new BulletChartPlugin().configure({ key: 'bullet' }),
        new CalendarChartPlugin().configure({ key: 'cal_heatmap' }),
        new ChordChartPlugin().configure({ key: 'chord' }),
        new CompareChartPlugin().configure({ key: 'compare' }),
        new CountryMapChartPlugin().configure({ key: 'country_map' }),
        new DistBarChartPlugin().configure({ key: 'dist_bar' }),
        new DualLineChartPlugin().configure({ key: 'dual_line' }),
        new EventFlowChartPlugin().configure({ key: 'event_flow' }),
        new FilterBoxChartPlugin().configure({ key: 'filter_box' }),
        new ForceDirectedChartPlugin().configure({ key: 'directed_force' }),
        new HeatmapChartPlugin().configure({ key: 'heatmap' }),
        new HistogramChartPlugin().configure({ key: 'histogram' }),
        new HorizonChartPlugin().configure({ key: 'horizon' }),
        new LineChartPlugin().configure({ key: 'line' }),
        // TODO: LineMulti
        new MapBoxChartPlugin().configure({ key: 'mapbox' }),
        new PairedTTestChartPlugin().configure({ key: 'paired_ttest' }),
        new ParallelCoordinatesChartPlugin().configure({ key: 'para' }),
        new PartitionChartPlugin().configure({ key: 'partition' }),
        new PieChartPlugin().configure({ key: 'pie' }),
        new PivotTableChartPlugin().configure({ key: 'pivot_table' }),
        new RoseChartPlugin().configure({ key: 'rose' }),
        new SankeyChartPlugin().configure({ key: 'sankey' }),
        new SunburstChartPlugin().configure({ key: 'sunburst' }),
        new TableChartPlugin().configure({ key: 'table' }),
        new TimeTableChartPlugin().configure({ key: 'time_table' }),
        new TimePivotChartPlugin().configure({ key: 'time_pivot' }),
        new TreemapChartPlugin().configure({ key: 'treemap' }),
        new WordCloudChartPlugin().configure({ key: 'word_cloud' }),
        new WorldMapChartPlugin().configure({ key: 'world_map' }),
      ],
    });
  }
}

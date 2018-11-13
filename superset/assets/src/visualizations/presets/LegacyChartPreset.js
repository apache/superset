import Preset from '../core/models/Preset';
import CommonChartPreset from './CommonChartPreset';
import DeckGLChartPreset from './DeckGLChartPreset';
import HierarchyChartPreset from './HierarchyChartPreset';
import MapChartPreset from './MapChartPreset';
import BulletChartPlugin from '../nvd3/Bullet/BulletChartPlugin';
import CalendarChartPlugin from '../Calendar/CalendarChartPlugin';
import ChordChartPlugin from '../Chord/ChordChartPlugin';
import CompareChartPlugin from '../nvd3/Compare/CompareChartPlugin';
import DualLineChartPlugin from '../nvd3/DualLine/DualLineChartPlugin';
import EventFlowChartPlugin from '../EventFlow/EventFlowChartPlugin';
import ForceDirectedChartPlugin from '../ForceDirected/ForceDirectedChartPlugin';
import HeatmapChartPlugin from '../Heatmap/HeatmapChartPlugin';
import HorizonChartPlugin from '../Horizon/HorizonChartPlugin';
import LineMultiChartPlugin from '../nvd3/LineMulti/LineMultiChartPlugin';
import PairedTTestChartPlugin from '../PairedTTest/PairedTTestChartPlugin';
import ParallelCoordinatesChartPlugin from '../ParallelCoordinates/ParallelCoordinatesChartPlugin';
import RoseChartPlugin from '../Rose/RoseChartPlugin';
import SankeyChartPlugin from '../Sankey/SankeyChartPlugin';
import TimePivotChartPlugin from '../nvd3/TimePivot/TimePivotChartPlugin';

export default class LegacyChartPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      presets: [
        new CommonChartPreset(),
        new DeckGLChartPreset(),
        new HierarchyChartPreset(),
        new MapChartPreset(),
      ],
      plugins: [
        new BulletChartPlugin().configure({ key: 'bullet' }),
        new CalendarChartPlugin().configure({ key: 'cal_heatmap' }),
        new ChordChartPlugin().configure({ key: 'chord' }),
        new CompareChartPlugin().configure({ key: 'compare' }),
        new DualLineChartPlugin().configure({ key: 'dual_line' }),
        new EventFlowChartPlugin().configure({ key: 'event_flow' }),
        new ForceDirectedChartPlugin().configure({ key: 'directed_force' }),
        new HeatmapChartPlugin().configure({ key: 'heatmap' }),
        new HorizonChartPlugin().configure({ key: 'horizon' }),
        new LineMultiChartPlugin().configure({ key: 'line_multi' }),
        new PairedTTestChartPlugin().configure({ key: 'paired_ttest' }),
        new ParallelCoordinatesChartPlugin().configure({ key: 'para' }),
        new RoseChartPlugin().configure({ key: 'rose' }),
        new SankeyChartPlugin().configure({ key: 'sankey' }),
        new TimePivotChartPlugin().configure({ key: 'time_pivot' }),
      ],
    });
  }
}

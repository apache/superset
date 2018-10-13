import Preset from '../core/models/Preset';
import CalendarChartPlugin from '../Calendar/CalendarChartPlugin';
import ChordChartPlugin from '../Chord/ChordChartPlugin';
import EventFlowChartPlugin from '../EventFlow/EventFlowChartPlugin';
import HorizonChartPlugin from '../Horizon/HorizonChartPlugin';
import PairedTTestChartPlugin from '../PairedTTest/PairedTTestChartPlugin';
import ParallelCoordinatesChartPlugin from '../ParallelCoordinates/ParallelCoordinatesChartPlugin';
import RoseChartPlugin from '../Rose/RoseChartPlugin';

export default class UncommonChartPreset extends Preset {
  constructor() {
    super({
      name: 'Uncommon charts',
      plugins: [
        new CalendarChartPlugin().configure({ key: 'cal_heatmap' }),
        new ChordChartPlugin().configure({ key: 'chord' }),
        new EventFlowChartPlugin().configure({ key: 'event_flow' }),
        new HorizonChartPlugin().configure({ key: 'horizon' }),
        new PairedTTestChartPlugin().configure({ key: 'paired_ttest' }),
        new ParallelCoordinatesChartPlugin().configure({ key: 'para' }),
        new RoseChartPlugin().configure({ key: 'rose' }),
      ],
    });
  }
}

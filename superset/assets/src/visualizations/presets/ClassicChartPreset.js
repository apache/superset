import Preset from '../core/models/Preset';
import AreaChartPlugin from '../nvd3/Area/AreaChartPlugin';
import BarChartPlugin from '../nvd3/Bar/BarChartPlugin';
import BigNumberChartPlugin from '../BigNumber/BigNumberChartPlugin';
import BigNumberTotalChartPlugin from '../BigNumberTotal/BigNumberTotalChartPlugin';
import BoxPlotChartPlugin from '../nvd3/BoxPlot/BoxPlotChartPlugin';
import BubbleChartPlugin from '../nvd3/Bubble/BubbleChartPlugin';
import LineChartPlugin from '../nvd3/Line/LineChartPlugin';

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
        new LineChartPlugin().configure({ key: 'line' }),
      ],
    });
  }
}

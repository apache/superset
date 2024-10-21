import { Behavior, t } from '@superset-ui/core';
import buildQuery from './buildQuery'
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from './img/single_1.png';
import example1 from './img/single_1.png';
import example2 from './img/dual_1.png';
import { EchartsChartPlugin } from '../types';
import { SpeedometerChartProps, SpeedometerChartFormData } from './types';

export default class SpeedoChartPlugin extends EchartsChartPlugin<
  SpeedometerChartFormData
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./SpeedoChart'),
      metadata: {
        behaviors: [
          Behavior.InteractiveChart,
          Behavior.DrillToDetail,
          Behavior.DrillBy,
        ],
        category: t('!CUSTOM'),
        credits: ['Killian Serluppens - ClubITBVBA'],
        description: t(
          'A Speedomet chart to see progres form  0-100 % '
        ),
        exampleGallery: [{url: example1}, {url: example2}],
        name: t('SpeedoChart'),
        tags: [
          t('Custom'),
          t('Report'),
          t('Featured'),
          t('Buisness'),
        ],
        thumbnail,
      },
      transformProps
    });
  }
}
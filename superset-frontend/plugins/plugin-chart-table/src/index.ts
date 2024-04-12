// DODO was here
import { Behavior, ChartMetadata, ChartPlugin, t } from '@superset-ui/core';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import example1 from './images/Table.jpg';
import example2 from './images/Table2.jpg';
import example3 from './images/Table3.jpg';
import controlPanel from './controlPanel';
import buildQuery from './buildQuery';
import { TableChartFormData, TableChartProps } from './types';

// must export something for the module to be exist in dev mode
export { default as __hack__ } from './types';
export * from './types';

const metadata = new ChartMetadata({
  behaviors: [
    Behavior.INTERACTIVE_CHART,
    Behavior.DRILL_TO_DETAIL,
    Behavior.DRILL_BY,
  ],
  category: t('Table'),
  canBeAnnotationTypes: ['EVENT', 'INTERVAL'],
  description: t(
    'Classic row-by-column spreadsheet like view of a dataset. Use tables to showcase a view into the underlying data or to show aggregated metrics.',
  ),
  exampleGallery: [{ url: example1 }, { url: example2 }, { url: example3 }],
  name: t('Table'),
  tags: [
    t('Additive'),
    t('Business'),
    t('Pattern'),
    t('Popular'),
    t('Report'),
    t('Sequential'),
    t('Tabular'),
    t('Description'),
  ],
  thumbnail,
});

export default class TableChartPlugin extends ChartPlugin<
  TableChartFormData,
  TableChartProps
> {
  constructor() {
    super({
      // loadChart: () => import('./TableChart'), // DODO commented
      loadChart: () => import('./DodoExtensions/TableChartDodo'), // DODO added
      metadata,
      transformProps,
      controlPanel,
      buildQuery,
    });
  }
}

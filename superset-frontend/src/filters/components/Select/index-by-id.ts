// DODO created 44211759

import { Behavior, ChartMetadata, ChartPlugin, t } from '@superset-ui/core';
import { cloneDeep } from 'lodash';
import { sharedControls } from '@superset-ui/chart-controls';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const panel = cloneDeep(controlPanel);

for (let i = 0; i < panel.controlPanelSections.length; i += 1) {
  const section = panel.controlPanelSections.at(i);
  // @ts-ignore
  if (section?.controlSetRows.at(0)?.at(0)?.name === 'groupby') {
    section?.controlSetRows?.at(0)?.push({
      name: 'groupbyid',
      config: {
        ...sharedControls.groupby,
        label: `${t('Column')} ID`,
        required: true,
      },
    });
  }
}

export default class FilterSelectPlugin extends ChartPlugin {
  constructor() {
    const metadata = new ChartMetadata({
      name: t('Select by id filter'),
      description: t("Select by id filter plugin using AntD'"),
      behaviors: [Behavior.InteractiveChart, Behavior.NativeFilter],
      enableNoResults: false,
      tags: [t('Experimental')],
      thumbnail,
    });

    super({
      buildQuery,
      controlPanel: panel,
      loadChart: () => import('./SelectFilterPlugin'),
      metadata,
      transformProps,
    });
  }
}

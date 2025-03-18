// DODO was here
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
  const controlSetRow = section?.controlSetRows?.[0];
  const controlSet = controlSetRow?.[0];
  // @ts-ignore
  if (controlSet && controlSet.name === 'groupby') {
    // @ts-ignore
    controlSet.config.label = `${t('Column')} EN`;
    controlSetRow.push({
      name: 'groupbyRu',
      config: {
        ...sharedControls.groupby,
        label: `${t('Column')} RU`,
        required: true,
      },
    });
  }
}

export default class FilterSelectWithTranslationPlugin extends ChartPlugin {
  constructor() {
    const metadata = new ChartMetadata({
      name: t('Select with translation'),
      description: t("Select with translation filter plugin using AntD'"),
      behaviors: [Behavior.InteractiveChart, Behavior.NativeFilter],
      enableNoResults: false,
      tags: [t('Experimental')],
      thumbnail,
    });

    super({
      buildQuery,
      controlPanel: panel,
      loadChart: () => import('./SelectFilterPluginWithTranslations'),
      metadata,
      transformProps,
    });
  }
}

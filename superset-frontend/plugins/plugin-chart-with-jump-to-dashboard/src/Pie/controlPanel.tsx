import { cloneDeep } from 'lodash';
import { ControlSetItem } from '@superset-ui/chart-controls';
import baseConfig from '../../../plugin-chart-echarts/src/Pie/controlPanel';
import { DEFAULT_FORM_DATA } from './types';

const config = cloneDeep(baseConfig);

export const jumpToDashboardControl: ControlSetItem = {
  name: 'jumpToDashboard',
  config: {
    type: 'TextAreaControl',
    description: 'Put dashboard map here',
    language: 'json',
    label: 'Jump To Dashboard',
    default: DEFAULT_FORM_DATA.jumpToDashboard,
  },
};

// @ts-ignore
config.controlPanelSections[1].controlSetRows.push([jumpToDashboardControl]);

export default config;

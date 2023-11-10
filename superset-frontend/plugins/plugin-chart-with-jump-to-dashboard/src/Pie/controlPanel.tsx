import baseConfig from '../../../plugin-chart-echarts/src/Pie/controlPanel';
import { DEFAULT_FORM_DATA } from './types';

const config = baseConfig;

// @ts-ignore
config.controlPanelSections[1].controlSetRows.push([
  {
    name: 'jumpToDashboard',
    config: {
      type: 'TextAreaControl',
      description: 'Put dashboard map here',
      language: 'json',
      label: 'Jump To Dashboard',
      default: DEFAULT_FORM_DATA.jumpToDashboard,
    },
  },
]);

export default config;

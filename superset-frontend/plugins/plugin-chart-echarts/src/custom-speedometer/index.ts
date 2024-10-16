import { Behavior, t } from '@superset-ui/core';
import buildQuery from './buildQuery'
// import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from './img/single_1.png';
import example1 from './img/single_1.png';
import example2 from './img/dual_1.png';
import { EchartsChartPlugin } from '../types';
import SpeedoChart from './SpeedoChart';
import setup from './setup';

export default setup({
  controlPanel: {
    controlPanelSections: [
      {
        label: t('Options'),
        expanded: true,
        controlSetRows: [
          ['metric'],
          ['minVal'],
          ['maxVal'],
          ['progress'],
        ],
      },
    ],
  },
  transformProps: (chartProps: { formData: any; queryData: any; }) => {
    const { formData, queryData } = chartProps;
    const { minVal, maxVal, progress } = formData;

    return {
      min: minVal,
      max: maxVal,
      progress: queryData.data[0][progress],  // Adjust based on your data
    };
  },
  loadChart: () => import('./SpeedoChart'),
});

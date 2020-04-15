import memoize from 'lodash/memoize';
import { getChartControlPanelRegistry } from '@superset-ui/chart';
import controls from '../explore/controls';

const getControlsInventory = memoize(vizType => {
  const controlsMap = {};
  getChartControlPanelRegistry()
    .get(vizType)
    .controlPanelSections.forEach(section => {
      section.controlSetRows.forEach(row => {
        row.forEach(control => {
          if (typeof control === 'string') {
            // For now, we have to look in controls.jsx to get the config for some controls.
            // Once everything is migrated out, delete this if statement.
            controlsMap[control] = controls[control];
          } else {
            controlsMap[control.name] = control.config;
          }
        });
      });
    });
  return controlsMap;
});

export default getControlsInventory;

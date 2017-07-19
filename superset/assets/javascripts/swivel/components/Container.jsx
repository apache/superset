/* eslint camelcase: 0 */
import React from 'react';
import { DragDropContext } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

import ChartContainer from './ChartContainer';
import MetricContainer from './MetricContainer';
import ColumnContainer from './ColumnContainer';
import RunToolbar from './RunToolbar';
import SettingsPanel from './SettingsPanel';

import QuerySettingsListener from '../listeners/QuerySettingsListener';
import VizSettingsListener from '../listeners/VizSettingsListener';

import DatasourceSelect from '../containers/DatasourceSelect';
import FilterContainer from '../containers/FilterContainer';
import SplitContainer from '../containers/SplitContainer';
import VizTypeSelect from '../containers/VizTypeSelect';


const style = {
  backgroundColor: 'white',
};

function Container() {
  return (
    <div style={{ ...style }} className="container-fluid">
      <QuerySettingsListener />
      <VizSettingsListener />
      <div id="swivel-side-bar" className="col-lg-2" style={{ order: '1' }}>
        <DatasourceSelect />
        <ColumnContainer />
        <MetricContainer />
      </div>

      <div className="col-lg-8" style={{ order: '2' }}>
        <div className="clearfix" id="swivel-drop-targets" style={{ marginTop: '1rem' }}>
          <FilterContainer />
          <SplitContainer />
        </div>
        <ChartContainer containerId="swivel-viz" />
      </div>
      <div className="col-lg-2" id="swivel-side-bar" style={{ order: '3' }}>
        <RunToolbar />
        <VizTypeSelect />
        <SettingsPanel />
      </div>
    </div>
  );
}

export default DragDropContext(HTML5Backend)(Container);

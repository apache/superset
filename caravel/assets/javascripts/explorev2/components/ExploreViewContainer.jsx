import React from 'react';
import ChartContainer from './ChartContainer';
import ControlPanelsContainer from './ControlPanelsContainer';
import QueryAndSaveButtons from './QueryAndSaveButtons';

const ExploreViewContainer = function () {
  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-sm-3">
          <QueryAndSaveButtons
            canAdd="True"
            onQuery={() => { console.log('clicked query'); }}
          />
          <br /><br />
          <ControlPanelsContainer />
        </div>
        <div className="col-sm-9">
          <ChartContainer />
        </div>
      </div>
    </div>
  );
};

export default ExploreViewContainer;

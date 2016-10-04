import React from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import ChartContainer from './ChartContainer';
import ControlPanelsContainer from './ControlPanelsContainer';
import QueryAndSaveButtons from './QueryAndSaveButtons';

const ExploreViewContainer = function (props) {
  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-sm-3">
          <QueryAndSaveButtons
            canAdd="True"
            onQuery={() => {}}
          />
          <br /><br />
          <ControlPanelsContainer />
        </div>
        <div className="col-sm-9">
          <ChartContainer
            viz={props.data.viz}
          />
        </div>
      </div>
    </div>
  );
};

function mapStateToProps(state) {
  return {}
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}
export default connect(mapStateToProps, mapDispatchToProps)(ExploreViewContainer);

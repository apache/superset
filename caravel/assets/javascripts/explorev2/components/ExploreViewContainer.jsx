import React from 'react';
import ChartContainer from './ChartContainer';
import ControlPanelsContainer from './ControlPanelsContainer';
import QueryAndSaveButtons from './QueryAndSaveButtons';

export default class ExploreViewContainer extends React.Component {
  getHeight() {
    const navHeight = 90;
    return (window.innerHeight - navHeight) + 'px';
  }

  render() {
    return (
      <div
        className="container-fluid"
        style={
          {
            height: this.getHeight(),
            overflow: 'hidden',
          }
        }
      >
        <div className="row table-body">
          <div className="table-cell col-sm-4">
            <QueryAndSaveButtons
              canAdd="True"
              onQuery={() => {}}
            />
            <br /><br />
            <ControlPanelsContainer />
          </div>
          <div className="table-cell col-sm-8">
            <ChartContainer
              viz={this.props.data.viz}
            />
          </div>
        </div>
      </div>
    );
  }
};

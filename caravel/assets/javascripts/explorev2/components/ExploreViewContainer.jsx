import React, { PropTypes } from 'react';
import ChartContainer from './ChartContainer';
import ControlPanelsContainer from './ControlPanelsContainer';
import QueryAndSaveButtons from './QueryAndSaveButtons';

const propTypes = {
  data: PropTypes.shape({
    viz: PropTypes.object.isRequired,
  }).isRequired,
};

export default class ExploreViewContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      height: this.getHeight(),
    };
  }

  getHeight() {
    const navHeight = 90;
    return `${window.innerHeight - navHeight}px`;
  }

  render() {
    return (
      <div
        className="container-fluid"
        style={{
          height: this.state.height,
          overflow: 'hidden',
        }}
      >
        <div className="row">
          <div className="col-sm-4">
            <QueryAndSaveButtons
              canAdd="True"
              onQuery={() => {}}
            />
            <br />
            <ControlPanelsContainer />
          </div>
          <div className="col-sm-8">
            <ChartContainer
              viz={this.props.data.viz}
              height={this.state.height}
            />
          </div>
        </div>
      </div>
    );
  }
}

ExploreViewContainer.propTypes = propTypes;

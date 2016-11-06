/* eslint camelcase: 0 */
import React from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import ChartContainer from './ChartContainer';
import ControlPanelsContainer from './ControlPanelsContainer';
import QueryAndSaveBtns from '../../explore/components/QueryAndSaveBtns';
const $ = require('jquery');

const propTypes = {
  form_data: React.PropTypes.object.isRequired,
  actions: React.PropTypes.object.isRequired,
  datasource_id: React.PropTypes.number.isRequired,
  datasource_type: React.PropTypes.string.isRequired,
};


class ExploreViewContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      height: this.getHeight(),
    };
  }

  onQuery() {
    const form_data = this.props.form_data;
    form_data.V2 = true;

    const params = $.param(this.props.form_data, true);
    const baseUrl =
      `/caravel/explore/${this.props.datasource_type}/${this.props.datasource_id}/`;
    const updateUrl =
      `/caravel/update_explore/${this.props.datasource_type}/${this.props.datasource_id}/`;
    const newEndpoint = `${baseUrl}?${params}`;

    $.ajax({
      type: 'POST',
      url: updateUrl,
      data: {
        data: JSON.stringify(this.props.form_data),
      },
      success: function (data) {
        this.props.actions.updateViz(JSON.parse(data));
      }.bind(this),
      error(error) {
        console.log(error);
      },
    });
    history.pushState({}, document.title, newEndpoint);
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
            <QueryAndSaveBtns
              canAdd="True"
              onQuery={this.onQuery.bind(this)}
            />
            <br /><br />
            <ControlPanelsContainer
              actions={this.props.actions}
              form_data={this.props.form_data}
            />
          </div>
          <div className="col-sm-8">
            <ChartContainer
              height={this.state.height}
            />
          </div>
        </div>
      </div>
    );
  }
}

ExploreViewContainer.propTypes = propTypes;

function mapStateToProps(state) {
  return {
    datasource_id: state.datasource_id,
    datasource_type: state.datasource_type,
    form_data: state.viz.form_data,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ControlPanelsContainer };

export default connect(mapStateToProps, mapDispatchToProps)(ExploreViewContainer);


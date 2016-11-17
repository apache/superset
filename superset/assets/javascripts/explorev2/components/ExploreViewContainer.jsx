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
    const data = {};
    const form_data = this.props.form_data;
    Object.keys(form_data).forEach((field) => {
      // filter out null fields
      if (form_data[field] !== null && field !== 'datasource') {
        data[field] = form_data[field];
      }
    });
    // V2 tag temporarily for updating url
    // Todo: remove after launch
    data.V2 = true;
    data.datasource_id = this.props.form_data.datasource;
    data.datasource_type = this.props.datasource_type;
    this.queryFormData(data);

    const params = $.param(data, true);
    this.updateUrl(params);
  }

  getHeight() {
    const navHeight = 90;
    return `${window.innerHeight - navHeight}px`;
  }

  updateUrl(params) {
    const baseUrl =
      `/superset/explore/${this.props.datasource_type}/${this.props.form_data.datasource}/`;
    const newEndpoint = `${baseUrl}?${params}`;
    history.pushState({}, document.title, newEndpoint);
  }

  queryFormData(data) {
    this.props.actions.updateExplore(
      this.props.datasource_type, this.props.form_data.datasource, data);
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

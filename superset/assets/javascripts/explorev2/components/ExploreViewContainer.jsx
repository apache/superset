/* eslint camelcase: 0 */
import React from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import ChartContainer from './ChartContainer';
import ControlPanelsContainer from './ControlPanelsContainer';
import SaveModal from './SaveModal';
import QueryAndSaveBtns from '../../explore/components/QueryAndSaveBtns';
import { autoQueryFields } from '../stores/store';
import { getParamObject } from '../exploreUtils';

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
      showModal: false,
    };
  }

  componentDidMount() {
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  componentWillReceiveProps(nextProps) {
    let refreshChart = false;
    autoQueryFields.forEach((field) => {
      if (nextProps.form_data[field] !== this.props.form_data[field]) {
        refreshChart = true;
      }
    });
    if (refreshChart) {
      this.onQuery(nextProps.form_data);
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  onQuery(form_data) {
    const data = getParamObject(form_data, this.props.datasource_type);
    this.queryFormData(data);

    const params = $.param(data, true);
    this.updateUrl(params);
    // remove alerts when query
    this.props.actions.removeControlPanelAlert();
    this.props.actions.removeChartAlert();
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
  handleResize() {
    this.setState({ height: this.getHeight() });
  }

  toggleModal() {
    this.setState({ showModal: !this.state.showModal });
  }

  render() {
    return (
      <div
        id="explore-container"
        className="container-fluid"
        style={{
          height: this.state.height,
          overflow: 'hidden',
        }}
      >
      {this.state.showModal &&
        <SaveModal
          onHide={this.toggleModal.bind(this)}
          actions={this.props.actions}
          form_data={this.props.form_data}
          datasource_type={this.props.datasource_type}
        />
      }
        <div className="row">
          <div className="col-sm-4">
            <QueryAndSaveBtns
              canAdd="True"
              onQuery={this.onQuery.bind(this, this.props.form_data)}
              onSave={this.toggleModal.bind(this)}
            />
            <br /><br />
            <ControlPanelsContainer
              actions={this.props.actions}
              form_data={this.props.form_data}
              datasource_type={this.props.datasource_type}
              onQuery={this.onQuery.bind(this, this.props.form_data)}
            />
          </div>
          <div className="col-sm-8">
            <ChartContainer
              actions={this.props.actions}
              height={this.state.height}
              actions={this.props.actions}
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

export { ExploreViewContainer };
export default connect(mapStateToProps, mapDispatchToProps)(ExploreViewContainer);

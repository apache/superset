/* eslint camelcase: 0 */
import React from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import ChartContainer from './ChartContainer';
import ControlPanelsContainer from './ControlPanelsContainer';
import SaveModal from './SaveModal';
import QueryAndSaveBtns from '../../explore/components/QueryAndSaveBtns';
import { autoQueryFields } from '../stores/fields';
import { getExploreUrl } from '../exploreUtils';

const propTypes = {
  form_data: React.PropTypes.object.isRequired,
  actions: React.PropTypes.object.isRequired,
  datasource_type: React.PropTypes.string.isRequired,
  chartStatus: React.PropTypes.string.isRequired,
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
    const refreshChart = Object.keys(nextProps.form_data).some((field) => (
      nextProps.form_data[field] !== this.props.form_data[field]
      && autoQueryFields.indexOf(field) !== -1)
    );
    if (refreshChart) {
      this.onQuery(nextProps.form_data);
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  onQuery(form_data) {
    this.props.actions.chartUpdateStarted();
    history.pushState(
      {},
      document.title,
      getExploreUrl(form_data, this.props.datasource_type)
    );
    // remove alerts when query
    this.props.actions.removeControlPanelAlert();
    this.props.actions.removeChartAlert();
  }

  getHeight() {
    const navHeight = 90;
    return `${window.innerHeight - navHeight}px`;
  }

  handleResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.setState({ height: this.getHeight() });
    }, 250);
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
              disabled={this.props.chartStatus === 'loading'}
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
    chartStatus: state.chartStatus,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ExploreViewContainer };
export default connect(mapStateToProps, mapDispatchToProps)(ExploreViewContainer);

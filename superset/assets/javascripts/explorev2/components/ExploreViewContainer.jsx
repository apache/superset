/* eslint camelcase: 0 */
import React from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import ChartContainer from './ChartContainer';
import ControlPanelsContainer from './ControlPanelsContainer';
import SaveModal from './SaveModal';
import QueryAndSaveBtns from './QueryAndSaveBtns';
import { getExploreUrl } from '../exploreUtils';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  datasource_type: React.PropTypes.string.isRequired,
  chartStatus: React.PropTypes.string.isRequired,
  fields: React.PropTypes.object.isRequired,
  form_data: React.PropTypes.object.isRequired,
  triggerQuery: React.PropTypes.bool.isRequired,
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
    this.props.actions.fetchDatasources();
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  componentWillReceiveProps(nextProps) {
    // Reset fields and run a query if the datasource or viz_type has changed
    if (
        nextProps.fields.datasource.value !== this.props.fields.datasource.value ||
        nextProps.fields.viz_type.value !== this.props.fields.viz_type.value) {
      this.props.actions.resetFields();
      this.props.actions.triggerQuery();
    }
  }

  componentDidUpdate() {
    if (this.props.triggerQuery) {
      this.runQuery();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  onQuery() {
    // remove alerts when query
    this.props.actions.removeControlPanelAlert();
    this.props.actions.removeChartAlert();

    this.runQuery();
    history.pushState(
      {},
      document.title,
      getExploreUrl(this.props.form_data));
  }

  getHeight() {
    const navHeight = 90;
    return `${window.innerHeight - navHeight}px`;
  }


  runQuery() {
    this.props.actions.runQuery(this.props.form_data, this.props.datasource_type);
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
  renderErrorMessage() {
    // Returns an error message as a node if any errors are in the store
    const errors = [];
    for (const fieldName in this.props.fields) {
      const field = this.props.fields[fieldName];
      if (field.validationErrors && field.validationErrors.length > 0) {
        errors.push(
          <div key={fieldName}>
            <strong>{`[ ${field.label} ] `}</strong>
            {field.validationErrors.join('. ')}
          </div>
        );
      }
    }
    let errorMessage;
    if (errors.length > 0) {
      errorMessage = (
        <div style={{ textAlign: 'left' }}>{errors}</div>
      );
    }
    return errorMessage;
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
              onQuery={this.onQuery.bind(this)}
              onSave={this.toggleModal.bind(this)}
              disabled={this.props.chartStatus === 'loading'}
              errorMessage={this.renderErrorMessage()}
            />
            <br />
            <ControlPanelsContainer
              actions={this.props.actions}
              form_data={this.props.form_data}
              datasource_type={this.props.datasource_type}
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
  const form_data = {};
  Object.keys(state.fields).forEach(f => {
    form_data[f] = state.fields[f].value;
  });
  return {
    chartStatus: state.chartStatus,
    datasource_type: state.datasource_type,
    fields: state.fields,
    form_data,
    triggerQuery: state.triggerQuery,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ExploreViewContainer };
export default connect(mapStateToProps, mapDispatchToProps)(ExploreViewContainer);

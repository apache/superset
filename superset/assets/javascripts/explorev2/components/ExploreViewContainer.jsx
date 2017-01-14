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
  fields: React.PropTypes.object.isRequired,
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
    this.runQuery();
  }

  componentWillReceiveProps(nextProps) {
    const refreshChart = Object.keys(nextProps.form_data).some((field) => (
      nextProps.form_data[field] !== this.props.form_data[field]
      && autoQueryFields.indexOf(field) !== -1)
    );
    if (refreshChart) {
      this.onQuery();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  onQuery() {
    this.runQuery();
    history.pushState(
      {},
      document.title,
      getExploreUrl(this.props.form_data, this.props.datasource_type)
    );
    // remove alerts when query
    this.props.actions.removeControlPanelAlert();
    this.props.actions.removeChartAlert();
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
              onQuery={this.onQuery.bind(this)}
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
    chartStatus: state.chartStatus,
    datasource_type: state.datasource_type,
    fields: state.fields,
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

/* eslint-disable react/no-danger */
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import SliceHeader from './SliceHeader';
import Slice from './Slice';
import StackTraceMessage from '../../components/StackTraceMessage';
import vizMap from '../../../visualizations/main';
import * as Actions from '../actions';
import { t } from '../../locales';

import '../../../stylesheets/dashboard.css';

const propTypes = {
  actions: PropTypes.object.isRequired,
  formData: PropTypes.object,
  timeout: PropTypes.number,
  datasource: PropTypes.object,
  isLoading: PropTypes.bool,
  isExpanded: PropTypes.bool,
  widgetHeight: PropTypes.number,
  widgetWidth: PropTypes.number,
  fetchSlice: PropTypes.func,
  removeSlice: PropTypes.func.isRequired,
  updateSliceName: PropTypes.func,
  getFormDataExtra: PropTypes.func,
  slice: PropTypes.object,
  filters: PropTypes.object,
  refresh: PropTypes.bool,
};

class SliceContainer extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      errorMsg: props.slice.error || '',
    };
  }

  componentDidMount() {
    this.fetchSliceAndRender();
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.slice.error !== this.state.errorMsg) {
      this.setError(nextProps.slice.error);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.slice.data && (
      prevProps.widgetHeight !== this.props.widgetHeight ||
      prevProps.widgetWidth !== this.props.widgetWidth ||
      prevProps.isExpanded !== this.props.isExpanded ||
      prevState.errorMsg !== this.state.errorMsg)
    ) {
      // re-render viz when: widget size changed, or set/clear error
      this.renderViz();
    }
  }

  getDescriptionId(slice) {
    return 'description_' + slice.slice_id;
  }

  getHeaderId(slice) {
    return 'header_' + slice.slice_id;
  }

  setError(msg) {
    this.setState({
      errorMsg: msg,
    });
  }

  clearError() {
    this.setState({
      errorMsg: '',
    });
  }

  fetchSliceAndRender() {
    const container = this;
    this.props.fetchSlice(this.props.slice, true)
      .done(() => {
        container.renderViz();
      });
  }

  width() {
    return this.props.widgetWidth - 10;
  }

  height(slice) {
    const widgetHeight = this.props.widgetHeight;
    const headerId = this.getHeaderId(slice);
    const descriptionId = this.getDescriptionId(slice);
    const headerHeight = this.refs[headerId] ? this.refs[headerId].offsetHeight : 30;
    let descriptionHeight = 0;
    if (this.props.isExpanded && this.refs[descriptionId]) {
      descriptionHeight = this.refs[descriptionId].offsetHeight + 10;
    }
    return widgetHeight - headerHeight - descriptionHeight;
  }

  renderViz() {
    const viz = vizMap[this.props.formData.viz_type];
    try {
      viz(this.refs.sliceEl, this.props.slice);
    } catch (e) {
      this.setError(t('An error occurred while rendering the visualization: ' + e));
    }
  }

  render() {
    const slice = this.props.slice;
    return (
      <div className="slice-cell" id={`${slice.slice_id}-cell`}>
        <div ref={this.getHeaderId(slice)}>
          <SliceHeader
            slice={slice}
            formDataExtra={this.props.getFormDataExtra(slice)}
            isExpanded={this.props.isExpanded}
            removeSlice={this.props.removeSlice}
            updateSliceName={this.props.updateSliceName}
            toggleExpandSlice={this.props.actions.toggleExpandSlice}
            forceRefresh={this.fetchSliceAndRender.bind(this)}
          />
        </div>
        <div
          className="slice_description bs-callout bs-callout-default"
          style={this.props.isExpanded ? {} : { display: 'none' }}
          ref={this.getDescriptionId(slice)}
          dangerouslySetInnerHTML={{ __html: slice.description_markeddown }}
        />
        <div className="row chart-container">
          <input type="hidden" value="false" />
          <div
            id={'token_' + slice.slice_id}
            className={`token col-md-12 ${this.props.isLoading ? 'is-loading' : ''}`}
          >
            {this.props.isLoading && (<img
              src="/static/assets/images/loading.gif"
              className="loading"
              alt="loading"
            />)}
            {this.props.slice.error &&
              <StackTraceMessage
                message={this.state.errorMsg}
                queryResponse={this.props.slice}
              />
            }
            <Slice
              containerId={`slice-container-${slice.slice_id}`}
              datasource={this.props.datasource}
              formData={this.props.formData}
              height={this.height.bind(this, slice)}
              width={this.width.bind(this)}
              addFilter={this.props.actions.addFilter}
              getFilters={() => (this.props.filters)}
              clearFilter={this.props.actions.clearFilter}
              removeFilter={this.props.actions.removeFilter}
              ref="sliceEl"
            />
          </div>
        </div>
      </div>
    );
  }
}

SliceContainer.propTypes = propTypes;

function mapStateToProps(state, ownProps) {
  return {
    alerts: state.alerts,
    timeout: state.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
    formData: ownProps.slice.formData,
    datasource: state.datasources[ownProps.slice.form_data.datasource],
    isLoading: [undefined, 'fetching'].indexOf(ownProps.slice.status) !== -1,
    isExpanded: state.dashboard.metadata.expanded_slices &&
      state.dashboard.metadata.expanded_slices[String(ownProps.slice.slice_id)],
    filters: state.filters,
    refresh: state.refresh,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export { SliceContainer };
export default connect(mapStateToProps, mapDispatchToProps)(SliceContainer);

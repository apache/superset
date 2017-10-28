/* eslint-disable react/no-danger */
import React from 'react';
import PropTypes from 'prop-types';

import SliceHeader from './SliceHeader';
import ChartContainer from '../../chart/ChartContainer';

import '../../../stylesheets/dashboard.css';

const propTypes = {
  timeout: PropTypes.number,
  datasource: PropTypes.object,
  isLoading: PropTypes.bool,
  isExpanded: PropTypes.bool,
  widgetHeight: PropTypes.number,
  widgetWidth: PropTypes.number,
  fetchSlice: PropTypes.func,
  removeSlice: PropTypes.func.isRequired,
  updateSliceName: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  slice: PropTypes.object,
  chartKey: PropTypes.string,
  formData: PropTypes.object,
  filters: PropTypes.object,
  addFilter: PropTypes.func,
  clearFilter: PropTypes.func,
  removeFilter: PropTypes.func,
  exploreChartUrl: PropTypes.string,
  exportCSVUrl: PropTypes.string,
};

class GridCell extends React.PureComponent {
  getDescriptionId(slice) {
    return 'description_' + slice.slice_id;
  }

  getHeaderId(slice) {
    return 'header_' + slice.slice_id;
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

  render() {
    const slice = this.props.slice;
    return (
      <div
        className={this.props.isLoading ? 'slice-cell-highlight' : 'slice-cell'}
        id={`${slice.slice_id}-cell`}
      >
        <div ref={this.getHeaderId(slice)}>
          <SliceHeader
            slice={slice}
            exploreChartUrl={this.props.exploreChartUrl}
            exportCSVUrl={this.props.exportCSVUrl}
            isExpanded={this.props.isExpanded}
            removeSlice={this.props.removeSlice}
            updateSliceName={this.props.updateSliceName}
            toggleExpandSlice={this.props.toggleExpandSlice}
            forceRefresh={() => this.props.fetchSlice(true)}
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
          <ChartContainer
            containerId={`slice-container-${slice.slice_id}`}
            chartKey={this.props.chartKey}
            datasource={this.props.datasource}
            formData={this.props.formData}
            height={this.height(slice)}
            width={this.width()}
            timeout={this.props.timeout}
            viz_type={slice.formData.viz_type}
            addFilter={this.props.addFilter.bind(this, slice.slice_id)}
            getFilters={() => (this.props.filters[slice.slice_id])}
            clearFilter={() => this.props.clearFilter.bind(this, slice.slice_id)}
            removeFilter={() => this.props.removeFilter.bind(this, slice.slice_id)}
          />
        </div>
      </div>
    );
  }
}

GridCell.propTypes = propTypes;

export default GridCell;

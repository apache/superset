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
  isCached: PropTypes.bool,
  cachedDttm: PropTypes.string,
  isExpanded: PropTypes.bool,
  widgetHeight: PropTypes.number,
  widgetWidth: PropTypes.number,
  slice: PropTypes.object,
  chartKey: PropTypes.string,
  formData: PropTypes.object,
  filters: PropTypes.object,
  forceRefresh: PropTypes.func,
  removeSlice: PropTypes.func,
  updateSliceName: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
  addFilter: PropTypes.func,
  getFilters: PropTypes.func,
  clearFilter: PropTypes.func,
  removeFilter: PropTypes.func,
  editMode: PropTypes.bool,
  annotationQuery: PropTypes.object,
};

const defaultProps = {
  forceRefresh: () => ({}),
  removeSlice: () => ({}),
  updateSliceName: () => ({}),
  toggleExpandSlice: () => ({}),
  exploreChart: () => ({}),
  exportCSV: () => ({}),
  addFilter: () => ({}),
  getFilters: () => ({}),
  clearFilter: () => ({}),
  removeFilter: () => ({}),
  editMode: false,
};

class GridCell extends React.PureComponent {
  constructor(props) {
    super(props);

    const sliceId = this.props.slice.slice_id;
    this.addFilter = this.props.addFilter.bind(this, sliceId);
    this.getFilters = this.props.getFilters.bind(this, sliceId);
    this.clearFilter = this.props.clearFilter.bind(this, sliceId);
    this.removeFilter = this.props.removeFilter.bind(this, sliceId);
  }

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
    const headerHeight = this.headerHeight(slice);
    const descriptionId = this.getDescriptionId(slice);
    let descriptionHeight = 0;
    if (this.props.isExpanded && this.refs[descriptionId]) {
      descriptionHeight = this.refs[descriptionId].offsetHeight + 10;
    }

    return widgetHeight - headerHeight - descriptionHeight;
  }

  headerHeight(slice) {
    const headerId = this.getHeaderId(slice);
    return this.refs[headerId] ? this.refs[headerId].offsetHeight : 30;
  }

  render() {
    const {
      isExpanded, isLoading, isCached, cachedDttm,
      removeSlice, updateSliceName, toggleExpandSlice, forceRefresh,
      chartKey, slice, datasource, formData, timeout, annotationQuery,
      exploreChart, exportCSV,
    } = this.props;
    return (
      <div
        className={isLoading ? 'slice-cell-highlight' : 'slice-cell'}
        id={`${slice.slice_id}-cell`}
      >
        <div ref={this.getHeaderId(slice)}>
          <SliceHeader
            slice={slice}
            isExpanded={isExpanded}
            isCached={isCached}
            cachedDttm={cachedDttm}
            removeSlice={removeSlice}
            updateSliceName={updateSliceName}
            toggleExpandSlice={toggleExpandSlice}
            forceRefresh={forceRefresh}
            editMode={this.props.editMode}
            annotationQuery={annotationQuery}
            exploreChart={exploreChart}
            exportCSV={exportCSV}
          />
        </div>
        {
        /* This usage of dangerouslySetInnerHTML is safe since it is being used to render
           markdown that is sanitized with bleach. See:
             https://github.com/apache/incubator-superset/pull/4390
           and
             https://github.com/apache/incubator-superset/commit/b6fcc22d5a2cb7a5e92599ed5795a0169385a825 */}
        <div
          className="slice_description bs-callout bs-callout-default"
          style={isExpanded ? {} : { display: 'none' }}
          ref={this.getDescriptionId(slice)}
          dangerouslySetInnerHTML={{ __html: slice.description_markeddown }}
        />
        <div className="row chart-container">
          <input type="hidden" value="false" />
          <ChartContainer
            containerId={`slice-container-${slice.slice_id}`}
            chartKey={chartKey}
            datasource={datasource}
            formData={formData}
            headerHeight={this.headerHeight(slice)}
            height={this.height(slice)}
            width={this.width()}
            timeout={timeout}
            vizType={slice.formData.viz_type}
            addFilter={this.addFilter}
            getFilters={this.getFilters}
            clearFilter={this.clearFilter}
            removeFilter={this.removeFilter}
          />
        </div>
      </div>
    );
  }
}

GridCell.propTypes = propTypes;
GridCell.defaultProps = defaultProps;

export default GridCell;

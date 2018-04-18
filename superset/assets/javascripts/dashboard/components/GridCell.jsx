/* eslint-disable react/no-danger */
import React from 'react';
import PropTypes from 'prop-types';

import SliceHeader from './SliceHeader';
import ChartContainer from '../../chart/ChartContainer';
import { chartPropType } from '../../chart/chartReducer';
import { slicePropShape } from '../reducers/propShapes';

const propTypes = {
  timeout: PropTypes.number,
  datasource: PropTypes.object,
  isLoading: PropTypes.bool,
  isCached: PropTypes.bool,
  cachedDttm: PropTypes.string,
  isExpanded: PropTypes.bool,
  widgetHeight: PropTypes.number,
  widgetWidth: PropTypes.number,
  slice: slicePropShape.isRequired,
  chart: PropTypes.shape(chartPropType).isRequired,
  formData: PropTypes.object,
  // filters: PropTypes.object,
  refreshChart: PropTypes.func,
  updateSliceName: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
  addFilter: PropTypes.func,
  getFilters: PropTypes.func,
  removeFilter: PropTypes.func,
  editMode: PropTypes.bool,
  annotationQuery: PropTypes.object,
};

const defaultProps = {
  refreshChart: () => ({}),
  updateSliceName: () => ({}),
  toggleExpandSlice: () => ({}),
  exploreChart: () => ({}),
  exportCSV: () => ({}),
  addFilter: () => ({}),
  getFilters: () => ({}),
  removeFilter: () => ({}),
  editMode: false,
};

class GridCell extends React.PureComponent {
  constructor(props) {
    super(props);

    const sliceId = this.props.slice.slice_id;
    this.forceRefresh = this.forceRefresh.bind(this);
    this.addFilter = this.props.addFilter.bind(this, this.props.chart);
    this.getFilters = this.props.getFilters.bind(this, sliceId);
    this.removeFilter = this.props.removeFilter.bind(this, sliceId);
  }

  getDescriptionId(slice) {
    return 'description_' + slice.slice_id;
  }

  getHeaderId(slice) {
    return 'header_' + slice.slice_id;
  }

  width() {
    return this.props.widgetWidth - 32;
  }

  height(slice) {
    const widgetHeight = this.props.widgetHeight;
    const headerHeight = this.headerHeight(slice);
    const descriptionId = this.getDescriptionId(slice);
    let descriptionHeight = 0;
    if (this.props.isExpanded && this.refs[descriptionId]) {
      descriptionHeight = this.refs[descriptionId].offsetHeight + 10;
    }

    return widgetHeight - headerHeight - descriptionHeight - 32;
  }

  headerHeight(slice) {
    const headerId = this.getHeaderId(slice);
    return this.refs[headerId] ? this.refs[headerId].offsetHeight : 30;
  }

  forceRefresh() {
    return this.props.refreshChart(this.props.chart, true, this.props.timeout);
  }

  render() {
    const {
      isExpanded,
      isLoading,
      isCached,
      cachedDttm,
      updateSliceName,
      toggleExpandSlice,
      chart,
      slice,
      datasource,
      formData,
      timeout,
      annotationQuery,
      exploreChart,
      exportCSV,
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
            updateSliceName={updateSliceName}
            toggleExpandSlice={toggleExpandSlice}
            forceRefresh={this.forceRefresh}
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
        <div className="chart-container"
             style={{ width: this.width(), height: this.height(slice) }}
        >
          <input type="hidden" value="false" />
          <ChartContainer
            containerId={`slice-container-${slice.slice_id}`}
            chart={chart}
            datasource={datasource}
            formData={formData}
            headerHeight={this.headerHeight(slice)}
            height={this.height(slice)}
            width={this.width()}
            timeout={timeout}
            vizType={slice.viz_type}
            addFilter={this.addFilter}
            getFilters={this.getFilters}
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

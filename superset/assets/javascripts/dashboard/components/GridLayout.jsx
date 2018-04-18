import React from 'react';
import PropTypes from 'prop-types';
// import cx from 'classnames';

// import GridCell from './GridCell';
import { slicePropShape } from '../reducers/propShapes';
import DashboardBuilder from '../v2/containers/DashboardBuilder';

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  layout: PropTypes.object.isRequired,
  datasources: PropTypes.object,
  charts: PropTypes.object.isRequired,
  slices: PropTypes.objectOf(slicePropShape).isRequired,
  filters: PropTypes.object,
  timeout: PropTypes.number,
  onChange: PropTypes.func,
  rerenderCharts: PropTypes.func,
  getFormDataExtra: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
  refreshChart: PropTypes.func,
  saveSliceName: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  addFilter: PropTypes.func,
  getFilters: PropTypes.func,
  removeFilter: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
};

const defaultProps = {
  onChange: () => ({}),
  getFormDataExtra: () => ({}),
  exploreChart: () => ({}),
  exportCSV: () => ({}),
  refreshChart: () => ({}),
  saveSliceName: () => ({}),
  toggleExpandSlice: () => ({}),
  addFilter: () => ({}),
  getFilters: () => ({}),
  removeFilter: () => ({}),
};

class GridLayout extends React.Component {
  constructor(props) {
    super(props);

    this.updateSliceName = this.props.dashboard.dash_edit_perm ?
      this.updateSliceName.bind(this) : null;
  }

  // getWidgetId(sliceId) {
  //   return 'widget_' + sliceId;
  // }

  // getWidgetHeight(sliceId) {
  //   const widgetId = this.getWidgetId(sliceId);
  //   if (!widgetId || !this.refs[widgetId]) {
  //     return 400;
  //   }
  //   return this.refs[widgetId].parentNode.clientHeight;
  // }
  //
  // getWidgetWidth(sliceId) {
  //   const widgetId = this.getWidgetId(sliceId);
  //   if (!widgetId || !this.refs[widgetId]) {
  //     return 400;
  //   }
  //   return this.refs[widgetId].parentNode.clientWidth;
  // }
  //
  // // updateSliceName(sliceId, sliceName) {
  // //   const key = 'slice_' + sliceId;
  // //   const currentSlice = this.props.slices[key];
  // //   if (!currentSlice || currentSlice.slice_name === sliceName) {
  // //     return;
  // //   }
  // //
  // //   this.props.saveSliceName(currentSlice, sliceName);
  // // }

  // isExpanded(sliceId) {
  //   return this.props.dashboard.metadata.expanded_slices &&
  //     this.props.dashboard.metadata.expanded_slices[sliceId];
  // }

  // componentDidUpdate(prevProps) {
  //   if (prevProps.editMode !== this.props.editMode) {
  //     this.props.rerenderCharts();
  //   }
  // }
  render() {
    return <DashboardBuilder />;

    // const cells = {};
    // this.props.dashboard.sliceIds.forEach((sliceId) => {
    //   const key = `slice_${sliceId}`;
    //   const currentChart = this.props.charts[key];
    //   const currentSlice = this.props.slices[key];
    //   if (currentChart) {
    //     const currentDatasource = this.props.datasources[currentChart.form_data.datasource];
    //     const queryResponse = currentChart.queryResponse || {};
    //     cells[key] = (
    //       <div
    //         id={key}
    //         key={sliceId}
    //         className={cx('widget', `${currentSlice.viz_type}`, { 'is-edit': this.props.editMode })}
    //         ref={this.getWidgetId(sliceId)}
    //       >
    //         <GridCell
    //           slice={currentSlice}
    //           chart={currentChart}
    //           datasource={currentDatasource}
    //           filters={this.props.filters}
    //           formData={this.props.getFormDataExtra(currentChart)}
    //           timeout={this.props.timeout}
    //           widgetHeight={this.getWidgetHeight(sliceId)}
    //           widgetWidth={this.getWidgetWidth(sliceId)}
    //           exploreChart={this.props.exploreChart}
    //           exportCSV={this.props.exportCSV}
    //           isExpanded={!!this.isExpanded(sliceId)}
    //           isLoading={currentChart.chartStatus === 'loading'}
    //           isCached={queryResponse.is_cached}
    //           cachedDttm={queryResponse.cached_dttm}
    //           toggleExpandSlice={this.props.toggleExpandSlice}
    //           refreshChart={this.props.refreshChart}
    //           updateSliceName={this.updateSliceName}
    //           addFilter={this.props.addFilter}
    //           getFilters={this.props.getFilters}
    //           removeFilter={this.props.removeFilter}
    //           editMode={this.props.editMode}
    //           annotationQuery={currentChart.annotationQuery}
    //           annotationError={currentChart.annotationError}
    //         />
    //       </div>
    //     );
    //   }
    // });
    //
    // return (
    //   <DashboardBuilder
    //     cells={cells}
    //   />
    // );
  }
}

GridLayout.propTypes = propTypes;
GridLayout.defaultProps = defaultProps;

export default GridLayout;

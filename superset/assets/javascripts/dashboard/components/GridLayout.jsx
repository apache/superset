import React from 'react';
import PropTypes from 'prop-types';
import { Responsive, WidthProvider } from 'react-grid-layout';

import GridCell from './GridCell';
import { slicePropShape, chartPropShape } from '../v2/util/propShapes';

require('react-grid-layout/css/styles.css');
require('react-resizable/css/styles.css');

const ResponsiveReactGridLayout = WidthProvider(Responsive);

const propTypes = {
  dashboardInfo: PropTypes.shape().isRequired,
  datasources: PropTypes.object,
  charts: PropTypes.objectOf(chartPropShape).isRequired,
  slices: PropTypes.objectOf(slicePropShape).isRequired,
  expandedSlices: PropTypes.object,
  filters: PropTypes.object,
  timeout: PropTypes.number,
  onChange: PropTypes.func,
  getFormDataExtra: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
  fetchChart: PropTypes.func,
  saveSliceName: PropTypes.func,
  removeSlice: PropTypes.func,
  removeChart: PropTypes.func,
  updateDashboardLayout: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  addFilter: PropTypes.func,
  getFilters: PropTypes.func,
  removeFilter: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
};

const defaultProps = {
  expandedSlices: {},
  filters: {},
  timeout: 60,
  onChange: () => ({}),
  getFormDataExtra: () => ({}),
  exploreChart: () => ({}),
  exportCSV: () => ({}),
  fetchChart: () => ({}),
  saveSlice: () => ({}),
  removeSlice: () => ({}),
  removeChart: () => ({}),
  updateDashboardLayout: () => ({}),
  toggleExpandSlice: () => ({}),
  addFilter: () => ({}),
  getFilters: () => ({}),
  removeFilter: () => ({}),
};

class GridLayout extends React.Component {
  constructor(props) {
    super(props);

    this.onResizeStop = this.onResizeStop.bind(this);
    this.onDragStop = this.onDragStop.bind(this);
    this.forceRefresh = this.forceRefresh.bind(this);
    this.removeSlice = this.removeSlice.bind(this);
    this.updateSliceName = this.props.dashboardInfo.dash_edit_perm ?
      this.updateSliceName.bind(this) : null;
  }

  onResizeStop(layout) {
    this.props.updateDashboardLayout(layout);
    this.props.onChange();
  }

  onDragStop(layout) {
    this.props.updateDashboardLayout(layout);
    this.props.onChange();
  }

  getWidgetId(sliceId) {
    return 'widget_' + sliceId;
  }

  getWidgetHeight(sliceId) {
    const widgetId = this.getWidgetId(sliceId);
    if (!widgetId || !this.refs[widgetId]) {
      return 400;
    }
    return this.refs[widgetId].offsetHeight;
  }

  getWidgetWidth(sliceId) {
    const widgetId = this.getWidgetId(sliceId);
    if (!widgetId || !this.refs[widgetId]) {
      return 400;
    }
    return this.refs[widgetId].offsetWidth;
  }

  forceRefresh(sliceId) {
    return this.props.fetchChart(this.props.charts[sliceId], true);
  }

  removeSlice(slice) {
    if (!slice) {
      return;
    }

    // remove slice dashboard and charts
    this.props.removeSlice(slice);
    this.props.removeChart(slice.slice_id);
    this.props.onChange();
  }

  updateSliceName(sliceId, sliceName) {
    const key = sliceId;
    const currentSlice = this.props.slices[key];
    if (!currentSlice || currentSlice.slice_name === sliceName) {
      return;
    }

    this.props.saveSliceName(currentSlice, sliceName);
  }

  isExpanded(sliceId) {
    return this.props.expandedSlices[sliceId];
  }

  render() {
    const cells = [];
    this.props.sliceIds.forEach((sliceId) => {
      const key = sliceId;
      const currentChart = this.props.charts[key];
      const currentSlice = this.props.slices[key];
      const currentDatasource = this.props.datasources[currentChart.form_data.datasource];
      const queryResponse = currentChart.queryResponse || {};

      cells.push(
        <div
          id={key}
          key={sliceId}
          className={`widget ${currentSlice.viz_type}`}
          ref={this.getWidgetId(sliceId)}
        >
          <GridCell
            slice={currentSlice}
            chartId={key}
            datasource={currentDatasource}
            filters={this.props.filters}
            formData={this.props.getFormDataExtra(currentChart)}
            timeout={this.props.timeout}
            widgetHeight={this.getWidgetHeight(sliceId)}
            widgetWidth={this.getWidgetWidth(sliceId)}
            exploreChart={this.props.exploreChart}
            exportCSV={this.props.exportCSV}
            isExpanded={!!this.isExpanded(sliceId)}
            isLoading={currentChart.chartStatus === 'loading'}
            isCached={queryResponse.is_cached}
            cachedDttm={queryResponse.cached_dttm}
            toggleExpandSlice={this.props.toggleExpandSlice}
            forceRefresh={this.forceRefresh}
            removeSlice={this.removeSlice}
            updateSliceName={this.updateSliceName}
            addFilter={this.props.addFilter}
            getFilters={this.props.getFilters}
            removeFilter={this.props.removeFilter}
            editMode={this.props.editMode}
            annotationQuery={currentChart.annotationQuery}
            annotationError={currentChart.annotationError}
          />
        </div>
      );
    });

    return (
      <ResponsiveReactGridLayout
        className="layout"
        layouts={{ lg: [] }}
        onResizeStop={this.onResizeStop}
        onDragStop={this.onDragStop}
        cols={{ lg: 48, md: 48, sm: 40, xs: 32, xxs: 24 }}
        rowHeight={10}
        autoSize
        margin={[20, 20]}
        useCSSTransforms
        draggableHandle=".drag"
      >
        {cells}
      </ResponsiveReactGridLayout>
    );
  }
}

GridLayout.propTypes = propTypes;
GridLayout.defaultProps = defaultProps;

export default GridLayout;

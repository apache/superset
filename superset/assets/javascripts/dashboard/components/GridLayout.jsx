import React from 'react';
import PropTypes from 'prop-types';
import { Responsive, WidthProvider } from 'react-grid-layout';

import GridCell from './GridCell';
import { getExploreUrl } from '../../explore/exploreUtils';

require('react-grid-layout/css/styles.css');
require('react-resizable/css/styles.css');

const ResponsiveReactGridLayout = WidthProvider(Responsive);

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  datasources: PropTypes.object,
  charts: PropTypes.object.isRequired,
  filters: PropTypes.object,
  timeout: PropTypes.number,
  onChange: PropTypes.func,
  getFormDataExtra: PropTypes.func,
  fetchSlice: PropTypes.func,
  saveSlice: PropTypes.func,
  removeSlice: PropTypes.func,
  removeChart: PropTypes.func,
  updateDashboardLayout: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  addFilter: PropTypes.func,
  getFilters: PropTypes.func,
  clearFilter: PropTypes.func,
  removeFilter: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
};

const defaultProps = {
  onChange: () => ({}),
  getFormDataExtra: () => ({}),
  fetchSlice: () => ({}),
  saveSlice: () => ({}),
  removeSlice: () => ({}),
  removeChart: () => ({}),
  updateDashboardLayout: () => ({}),
  toggleExpandSlice: () => ({}),
  addFilter: () => ({}),
  getFilters: () => ({}),
  clearFilter: () => ({}),
  removeFilter: () => ({}),
};

class GridLayout extends React.Component {
  constructor(props) {
    super(props);

    this.onResizeStop = this.onResizeStop.bind(this);
    this.onDragStop = this.onDragStop.bind(this);
    this.forceRefresh = this.forceRefresh.bind(this);
    this.removeSlice = this.removeSlice.bind(this);
    this.updateSliceName = this.props.dashboard.dash_edit_perm ?
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

  getWidgetId(slice) {
    return 'widget_' + slice.slice_id;
  }

  getWidgetHeight(slice) {
    const widgetId = this.getWidgetId(slice);
    if (!widgetId || !this.refs[widgetId]) {
      return 400;
    }
    return this.refs[widgetId].offsetHeight;
  }

  getWidgetWidth(slice) {
    const widgetId = this.getWidgetId(slice);
    if (!widgetId || !this.refs[widgetId]) {
      return 400;
    }
    return this.refs[widgetId].offsetWidth;
  }

  findSliceIndexById(sliceId) {
    return this.props.dashboard.slices
      .map(slice => (slice.slice_id)).indexOf(sliceId);
  }

  forceRefresh(sliceId) {
    return this.props.fetchSlice(this.props.charts['slice_' + sliceId], true);
  }

  removeSlice(slice) {
    if (!slice) {
      return;
    }

    // remove slice dashbaord and charts
    this.props.removeSlice(slice);
    this.props.removeChart(this.props.charts['slice_' + slice.slice_id].chartKey);
    this.props.onChange();
  }

  updateSliceName(sliceId, sliceName) {
    const index = this.findSliceIndexById(sliceId);
    if (index === -1) {
      return;
    }

    const currentSlice = this.props.dashboard.slices[index];
    if (currentSlice.slice_name === sliceName) {
      return;
    }

    this.props.saveSlice(currentSlice, sliceName);
  }

  isExpanded(slice) {
    return this.props.dashboard.metadata.expanded_slices &&
      this.props.dashboard.metadata.expanded_slices[slice.slice_id];
  }

  render() {
    const cells = this.props.dashboard.slices.map((slice) => {
      const chartKey = `slice_${slice.slice_id}`;
      const currentChart = this.props.charts[chartKey];
      const queryResponse = currentChart.queryResponse || {};
      return (
        <div
          id={'slice_' + slice.slice_id}
          key={slice.slice_id}
          data-slice-id={slice.slice_id}
          className={`widget ${slice.form_data.viz_type}`}
          ref={this.getWidgetId(slice)}
        >
          <GridCell
            slice={slice}
            chartKey={chartKey}
            datasource={this.props.datasources[slice.form_data.datasource]}
            filters={this.props.filters}
            formData={this.props.getFormDataExtra(slice)}
            timeout={this.props.timeout}
            widgetHeight={this.getWidgetHeight(slice)}
            widgetWidth={this.getWidgetWidth(slice)}
            exploreChartUrl={getExploreUrl(this.props.getFormDataExtra(slice))}
            exportCSVUrl={getExploreUrl(this.props.getFormDataExtra(slice), 'csv')}
            isExpanded={!!this.isExpanded(slice)}
            isLoading={currentChart.chartStatus === 'loading'}
            isCached={queryResponse.is_cached}
            cachedDttm={queryResponse.cached_dttm}
            toggleExpandSlice={this.props.toggleExpandSlice}
            forceRefresh={this.forceRefresh}
            removeSlice={this.removeSlice}
            updateSliceName={this.updateSliceName}
            addFilter={this.props.addFilter}
            getFilters={this.props.getFilters}
            clearFilter={this.props.clearFilter}
            removeFilter={this.props.removeFilter}
            editMode={this.props.editMode}
          />
        </div>);
    });

    return (
      <ResponsiveReactGridLayout
        className="layout"
        layouts={{ lg: this.props.dashboard.layout }}
        onResizeStop={this.onResizeStop}
        onDragStop={this.onDragStop}
        cols={{ lg: 12, md: 12, sm: 10, xs: 8, xxs: 6 }}
        rowHeight={100}
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

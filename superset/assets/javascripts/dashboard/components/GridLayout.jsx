import React from 'react';
import PropTypes from 'prop-types';
import { Responsive, WidthProvider } from 'react-grid-layout';

import GridCell from './GridCell';
import { slicePropShape } from '../reducers/propShapes';

require('react-grid-layout/css/styles.css');
require('react-resizable/css/styles.css');

const ResponsiveReactGridLayout = WidthProvider(Responsive);

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  datasources: PropTypes.object,
  charts: PropTypes.object.isRequired,
  allSlices: PropTypes.objectOf(slicePropShape).isRequired,
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
    return this.props.fetchChart(this.props.charts['slice_' + sliceId], true);
  }

  removeSlice(slice) {
    if (!slice) {
      return;
    }

    // remove slice dashboard and charts
    this.props.removeSlice(slice);
    this.props.removeChart(this.props.charts['slice_' + slice.slice_id].chartKey);
    this.props.onChange();
  }

  updateSliceName(sliceId, sliceName) {
    const key = 'slice_' + sliceId;
    const currentSlice = this.props.allSlices[key];
    if (!currentSlice || currentSlice.slice_name === sliceName) {
      return;
    }

    this.props.saveSliceName(currentSlice, sliceName);
  }

  isExpanded(sliceId) {
    return this.props.dashboard.metadata.expanded_slices &&
      this.props.dashboard.metadata.expanded_slices[sliceId];
  }

  render() {
    const cells = this.props.dashboard.sliceIds.map((sliceId) => {
      const key = `slice_${sliceId}`;
      const currentChart = this.props.charts[key];
      const currentSlice = this.props.allSlices[key];
      const currentDatasource = this.props.datasources[currentChart.form_data.datasource];
      const queryResponse = currentChart.queryResponse || {};

      return (
        <div
          id={key}
          key={sliceId}
          className={`widget ${currentSlice.viz_type}`}
          ref={this.getWidgetId(sliceId)}
        >
          <GridCell
            slice={currentSlice}
            chartKey={key}
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
        </div>);
    });

    return (
      <ResponsiveReactGridLayout
        className="layout"
        layouts={{ lg: this.props.dashboard.layout }}
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

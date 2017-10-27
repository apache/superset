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
  clearFilter: PropTypes.func,
  removeFilter: PropTypes.func,
};

class GridLayout extends React.Component {
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

  removeSlice(slice, chart) {
    if (!slice || !chart) {
      return;
    }

    // remove slice dashbaord and charts
    this.props.removeSlice(slice);
    this.props.removeChart(chart.chartKey);
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
    return (
      <ResponsiveReactGridLayout
        className="layout"
        layouts={{ lg: this.props.dashboard.layout }}
        onResizeStop={this.onResizeStop.bind(this)}
        onDragStop={this.onDragStop.bind(this)}
        cols={{ lg: 12, md: 12, sm: 10, xs: 8, xxs: 6 }}
        rowHeight={100}
        autoSize
        margin={[20, 20]}
        useCSSTransforms
        draggableHandle=".drag"
      >
        {this.props.dashboard.slices.map(slice => (
          <div
            id={'slice_' + slice.slice_id}
            key={slice.slice_id}
            data-slice-id={slice.slice_id}
            className={`widget ${slice.form_data.viz_type}`}
            ref={this.getWidgetId(slice)}
          >
            <GridCell
              slice={slice}
              chartKey={'slice_' + slice.slice_id}
              datasource={this.props.datasources[slice.form_data.datasource]}
              filters={this.props.filters}
              formData={this.props.getFormDataExtra(slice)}
              timeout={this.props.timeout}
              widgetHeight={this.getWidgetHeight(slice)}
              widgetWidth={this.getWidgetWidth(slice)}
              exploreChartUrl={getExploreUrl(this.props.getFormDataExtra(slice))}
              exportCSVUrl={getExploreUrl(this.props.getFormDataExtra(slice), 'csv')}
              isExpanded={!!this.isExpanded(slice)}
              isLoading={[undefined, 'loading']
                .indexOf(this.props.charts['slice_' + slice.slice_id].chartStatus) !== -1}
              toggleExpandSlice={this.props.toggleExpandSlice}
              fetchSlice={this.props.fetchSlice.bind(this, this.props.charts['slice_' + slice.slice_id])}
              removeSlice={this.removeSlice.bind(this, slice, this.props.charts['slice_' + slice.slice_id])}
              updateSliceName={this.props.dashboard.dash_edit_perm ?
                this.updateSliceName.bind(this) : null}
              addFilter={this.props.addFilter}
              clearFilter={this.props.clearFilter}
              removeFilter={this.props.removeFilter}
            />
          </div>
        ))}
      </ResponsiveReactGridLayout>
    );
  }
}
GridLayout.propTypes = propTypes;

export default GridLayout;

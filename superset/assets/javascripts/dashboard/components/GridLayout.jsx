import React from 'react';
import PropTypes from 'prop-types';
import { Responsive, WidthProvider } from 'react-grid-layout';

import SliceContainer from './SliceContainer';

require('react-grid-layout/css/styles.css');
require('react-resizable/css/styles.css');

const ResponsiveReactGridLayout = WidthProvider(Responsive);

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  actions: PropTypes.object,
  fetchSlice: PropTypes.func,
  onChange: PropTypes.func,
  getFormDataExtra: PropTypes.func,
};

class GridLayout extends React.Component {
  onResizeStop(layout) {
    this.props.actions.updateDashboardLayout(layout);
    this.props.onChange();
  }

  onDragStop(layout) {
    this.props.actions.updateDashboardLayout(layout);
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

  removeSlice(sliceId) {
    const index = this.findSliceIndexById(sliceId);
    if (index === -1) {
      return;
    }

    this.props.actions.removeSlice(this.props.dashboard.slices[index]);
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

    this.props.actions.saveSlice(currentSlice, sliceName);
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
            <SliceContainer
              slice={slice}
              widgetHeight={this.getWidgetHeight(slice)}
              widgetWidth={this.getWidgetWidth(slice)}
              getFormDataExtra={this.props.getFormDataExtra}
              fetchSlice={this.props.fetchSlice}
              removeSlice={this.removeSlice.bind(this, slice.slice_id)}
              updateSliceName={this.props.dashboard.dash_edit_perm ?
                this.updateSliceName.bind(this) : null}
            />
          </div>
        ))}
      </ResponsiveReactGridLayout>
    );
  }
}
GridLayout.propTypes = propTypes;

export default GridLayout;

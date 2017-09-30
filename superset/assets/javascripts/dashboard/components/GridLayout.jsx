/* global notify */
import React from 'react';
import PropTypes from 'prop-types';
import { Responsive, WidthProvider } from 'react-grid-layout';
import $ from 'jquery';

import SliceCell from './SliceCell';
import { getExploreUrl } from '../../explore/exploreUtils';

require('react-grid-layout/css/styles.css');
require('react-resizable/css/styles.css');

const ResponsiveReactGridLayout = WidthProvider(Responsive);

const propTypes = {
  dashboard: PropTypes.object.isRequired,
};

class GridLayout extends React.Component {
  componentWillMount() {
    const layout = [];

    this.props.dashboard.slices.forEach((slice, index) => {
      const sliceId = slice.slice_id;
      let pos = this.props.dashboard.posDict[sliceId];
      if (!pos) {
        pos = {
          col: (index * 4 + 1) % 12,
          row: Math.floor((index) / 3) * 4,
          size_x: 4,
          size_y: 4,
        };
      }

      layout.push({
        i: String(sliceId),
        x: pos.col - 1,
        y: pos.row,
        w: pos.size_x,
        minW: 2,
        h: pos.size_y,
      });
    });

    this.setState({
      layout,
      slices: this.props.dashboard.slices,
    });
  }

  onResizeStop(layout, oldItem, newItem) {
    const newSlice = this.props.dashboard.getSlice(newItem.i);
    if (oldItem.w !== newItem.w || oldItem.h !== newItem.h) {
      this.setState({ layout }, () => newSlice.resize());
    }
    this.props.dashboard.onChange();
  }

  onDragStop(layout) {
    this.setState({ layout });
    this.props.dashboard.onChange();
  }

  removeSlice(sliceId) {
    $('[data-toggle=tooltip]').tooltip('hide');
    this.setState({
      layout: this.state.layout.filter(function (reactPos) {
        return reactPos.i !== String(sliceId);
      }),
      slices: this.state.slices.filter(function (slice) {
        return slice.slice_id !== sliceId;
      }),
    });
    this.props.dashboard.onChange();
  }

  updateSliceName(sliceId, sliceName) {
    const index = this.state.slices.map(slice => (slice.slice_id)).indexOf(sliceId);
    if (index === -1) {
      return;
    }

    // update slice_name first
    const oldSlices = this.state.slices;
    const currentSlice = this.state.slices[index];
    const updated = Object.assign({},
        this.state.slices[index], { slice_name: sliceName });
    const updatedSlices = this.state.slices.slice();
    updatedSlices[index] = updated;
    this.setState({ slices: updatedSlices });

    const sliceParams = {};
    sliceParams.slice_id = currentSlice.slice_id;
    sliceParams.action = 'overwrite';
    sliceParams.slice_name = sliceName;
    const saveUrl = getExploreUrl(currentSlice.form_data, 'base', false, null, sliceParams);

    $.ajax({
      url: saveUrl,
      type: 'GET',
      success: () => {
        notify.success('This slice name was saved successfully.');
      },
      error: () => {
        // if server-side reject the overwrite action,
        // revert to old state
        this.setState({ slices: oldSlices });
        notify.error('You don\'t have the rights to alter this slice');
      },
    });
  }

  serialize() {
    return this.state.layout.map(reactPos => ({
      slice_id: reactPos.i,
      col: reactPos.x + 1,
      row: reactPos.y,
      size_x: reactPos.w,
      size_y: reactPos.h,
    }));
  }

  render() {
    return (
      <ResponsiveReactGridLayout
        className="layout"
        layouts={{ lg: this.state.layout }}
        onResizeStop={this.onResizeStop.bind(this)}
        onDragStop={this.onDragStop.bind(this)}
        cols={{ lg: 12, md: 12, sm: 10, xs: 8, xxs: 6 }}
        rowHeight={100}
        autoSize
        margin={[20, 20]}
        useCSSTransforms
        draggableHandle=".drag"
      >
        {this.state.slices.map(slice => (
          <div
            id={'slice_' + slice.slice_id}
            key={slice.slice_id}
            data-slice-id={slice.slice_id}
            className={`widget ${slice.form_data.viz_type}`}
          >
            <SliceCell
              slice={slice}
              removeSlice={this.removeSlice.bind(this, slice.slice_id)}
              expandedSlices={this.props.dashboard.metadata.expanded_slices}
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

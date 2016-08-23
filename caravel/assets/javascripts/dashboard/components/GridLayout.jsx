import $ from 'jquery';
import React, { PropTypes } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
const ResponsiveReactGridLayout = WidthProvider(Responsive);
import SliceCell from './SliceCell';

require('../../../node_modules/react-grid-layout/css/styles.css');
require('../../../node_modules/react-resizable/css/styles.css');

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  slices: PropTypes.arrayOf(PropTypes.object).isRequired,
  posDict: PropTypes.object.isRequired,
};

class GridLayout extends React.Component {
  componentWillMount() {
    const layout = [];

    this.props.slices.forEach((slice, index) => {
      let pos = this.props.posDict[slice.slice_id];
      if (!pos) {
        pos = {
          col: (index * 4 + 1) % 12,
          row: Math.floor((index) / 3) * 4,
          size_x: 4,
          size_y: 4,
        };
      }

      layout.push({
        i: String(slice.slice_id),
        x: pos.col - 1,
        y: pos.row,
        w: pos.size_x,
        minW: 2,
        h: pos.size_y,
      });
    });

    this.setState({
      layout,
      slices: this.props.slices,
    });
  }

  onResizeStop(layout, oldItem, newItem) {
    const newSlice = this.props.dashboard.getSlice(newItem.i);
    if (oldItem.w !== newItem.w || oldItem.h !== newItem.h) {
      this.setState({ layout }, () => { newSlice.resize(); });
    }
  }

  onDragStop(layout) {
    this.setState({ layout });
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
  }

  serialize() {
    return this.state.layout.map(function (reactPos) {
      return {
        slice_id: reactPos.i,
        col: reactPos.x + 1,
        row: reactPos.y,
        size_x: reactPos.w,
        size_y: reactPos.h,
      };
    });
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
        {
          /* eslint arrow-body-style: 0 */
          this.state.slices.map((slice) => {
            return (
              <div
                id={'slice_' + slice.slice_id}
                key={slice.slice_id}
                data-slice-id={slice.slice_id}
                className={`widget ${slice.viz_name}`}
              >
                <SliceCell
                  slice={slice}
                  removeSlice={(sliceId) => this.removeSlice(sliceId)}
                  expandedSlices={this.props.dashboard.metadata.expanded_slices}
                />
              </div>
            );
          })
        }
      </ResponsiveReactGridLayout>
    );
  }
}

GridLayout.propTypes = propTypes;

export default GridLayout;

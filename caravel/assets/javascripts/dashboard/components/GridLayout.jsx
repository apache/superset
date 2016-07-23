import React, { PropTypes } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
const ResponsiveReactGridLayout = WidthProvider(Responsive);

require('../../../node_modules/react-grid-layout/css/styles.css');
require('../../../node_modules/react-resizable/css/styles.css');

const sliceCellPropTypes = {
  slice: PropTypes.object.isRequired,
  removeSlice: PropTypes.func.isRequired,
  expandedSlices: PropTypes.object
};

const gridLayoutPropTypes = {
  dashboard: PropTypes.object.isRequired,
  slices: PropTypes.arrayOf(PropTypes.object).isRequired,
  posDict: PropTypes.object.isRequired
};

class SliceCell extends React.Component {
  render() {
    const slice = this.props.slice,
          createMarkup = function () {
            return { __html: slice.description_markeddown };
          };

    return (
      <div>
        <div className="chart-header">
          <div className="row">
            <div className="col-md-12 text-center header">
              {slice.slice_name}
            </div>
            <div className="col-md-12 chart-controls">
              <div className="pull-left">
                <a title="Move chart" data-toggle="tooltip">
                  <i className="fa fa-arrows drag"/>
                </a>
                <a className="refresh" title="Force refresh data" data-toggle="tooltip">
                  <i className="fa fa-repeat"/>
                </a>
              </div>
              <div className="pull-right">
                {slice.description ?
                  <a title="Toggle chart description">
                    <i className="fa fa-info-circle slice_info" title={slice.description} data-toggle="tooltip"/>
                  </a>
                : ""}
                <a href={slice.edit_url} title="Edit chart" data-toggle="tooltip">
                  <i className="fa fa-pencil"/>
                </a>
                <a href={slice.slice_url} title="Explore chart" data-toggle="tooltip">
                  <i className="fa fa-share"/>
                </a>
                <a className="remove-chart" title="Remove chart from dashboard" data-toggle="tooltip">
                  <i className="fa fa-close" onClick={this.props.removeSlice.bind(null, slice.slice_id)}/>
                </a>
              </div>
            </div>

          </div>
        </div>
        <div
          className="slice_description bs-callout bs-callout-default"
          style={this.props.expandedSlices && this.props.expandedSlices[String(slice.slice_id)] ? {} : { display: "none" }}
          dangerouslySetInnerHTML={createMarkup()}>
        </div>
        <div className="row chart-container">
          <input type="hidden" value="false"/>
          <div id={slice.token} className="token col-md-12">
            <img src="/static/assets/images/loading.gif" className="loading" alt="loading"/>
            <div className="slice_container" id={slice.token + "_con"}></div>
          </div>
        </div>
      </div>
    );
  }
}

class GridLayout extends React.Component {
  removeSlice(sliceId) {
    $('[data-toggle="tooltip"]').tooltip("hide");
    this.setState({
      layout: this.state.layout.filter(function (reactPos) {
        return reactPos.i !== String(sliceId);
      }),
      slices: this.state.slices.filter(function (slice) {
        return slice.slice_id !== sliceId;
      })
    });
  }

  onResizeStop(layout, oldItem, newItem) {
    if (oldItem.w !== newItem.w || oldItem.h !== newItem.h) {
      this.setState({
        layout: layout
      }, function () {
        this.props.dashboard.getSlice(newItem.i).resize();
      });
    }
  }

  onDragStop(layout) {
    this.setState({
      layout: layout
    });
  }

  serialize() {
    return this.state.layout.map(function (reactPos) {
      return {
        slice_id: reactPos.i,
        col: reactPos.x + 1,
        row: reactPos.y,
        size_x: reactPos.w,
        size_y: reactPos.h
      };
    });
  }

  componentWillMount() {
    var layout = [];

    this.props.slices.forEach(function (slice, index) {
      var pos = this.props.posDict[slice.slice_id];
      if (!pos) {
        pos = {
          col: (index * 4 + 1) % 12,
          row: Math.floor((index) / 3) * 4,
          size_x: 4,
          size_y: 4
        };
      }

      layout.push({
        i: String(slice.slice_id),
        x: pos.col - 1,
        y: pos.row,
        w: pos.size_x,
        minW: 2,
        h: pos.size_y
      });
    }, this);

    this.setState({
      layout: layout,
      slices: this.props.slices
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
        autoSize={true}
        margin={[20, 20]}
        useCSSTransforms={false}
        draggableHandle=".drag">
        {this.state.slices.map((slice) => {
          return (
            <div
              id={'slice_' + slice.slice_id}
              key={slice.slice_id}
              data-slice-id={slice.slice_id}
              className={"widget " + slice.viz_name}>
              <SliceCell
                slice={slice}
                removeSlice={this.removeSlice.bind(this)}
                expandedSlices={this.props.dashboard.metadata.expanded_slices}/>
            </div>
          );
        })}
      </ResponsiveReactGridLayout>
    );
  }
}

SliceCell.propTypes = sliceCellPropTypes;
GridLayout.propTypes = gridLayoutPropTypes;

export default GridLayout;

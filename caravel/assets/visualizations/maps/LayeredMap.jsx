import React from 'react';
import ScatterPlotClusterOverlay from './ScatterPlotClusterOverlay.jsx';
import BaseMapWrapper from './BaseMapWrapper.jsx';
import {PointMapRaw} from './PointMap.jsx';
import ViewportMercator from 'viewport-mercator-project';
import Immutable from 'immutable';
import supercluster from 'supercluster';

const DEFAULT_MAX_ZOOM = 16;
const propTypes = {
  layers: React.PropTypes.arrayOf(React.PropTypes.string),
};

class LayeredMapViz extends React.Component {
  constructor(props) {
    super(props);

    this.slicesLoaded = false;
  }

  componentDidMount() {
    this.sliceIdsRequest = $.ajax({
      url: '/sliceaddview/api/read?_flt_0_created_by=' + this.props.slice.curUserId,
      type: 'GET',
      success: function (response) {
        console.log(this.props.layers)
        let sliceMap = {}
        // Prepare slice data for table
        response.result.forEach(function (slice) {
          sliceMap[slice.data.slice_id] = slice.data.json_endpoint;
        });

        let deferreds = [];
        this.props.layers.forEach((sliceId) => {
          deferreds.push(this.getSliceJson(sliceMap[sliceId]));
        }, this);
        let that = this;

        this.slicesRequest = $.when.apply(null, deferreds)
          .done(function() {
            // (data, textStatus, jqXHR) repeating
            const args = Array.prototype.slice.call(arguments);
            let sliceArgs = [];
            for (let i = 0 ; i < args.length ; i++) {
              sliceArgs.push(args[i][0].data);
            }

            console.log(args)
            console.log(sliceArgs)

            that.slicesLoaded = true;
            that.setState({
              sliceArgs: sliceArgs
            });
          });
      }.bind(this),
      error: function (error) {
        console.log("get slice id errored")
      }.bind(this),
    });
  }

  getSliceJson(jsonEndpoint) {
    return $.ajax({
      type: "GET",
      url: jsonEndpoint,
      success: function (json) {
        return json.data;
      },
      error: function (error) {
        console.log(error.responseText);
        return null;
      }
    });
  }

  render() {
    if (!this.slicesLoaded || this.state.sliceArgs.length == 0) {
      return null;
    }

    /*
    todo:
      allow list of slice ids, use: http://localhost:8088/sliceaddview/api/read to get json endpoint
      use slice_id as key for layers
    */

    return (<div>
      {this.state.sliceArgs.map((args, i) => {
        return (
          <PointMapRaw
            key={i}
            {...$.extend(args, this.props)}
          />
        );
      })}
    </div>);
  }
}

LayeredMapViz.propTypes = propTypes;

export default BaseMapWrapper(LayeredMapViz);

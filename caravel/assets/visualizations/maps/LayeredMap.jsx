/* global $ */

import React from 'react';
import BaseMapWrapper from './BaseMapWrapper.jsx';
import { PointMapRaw } from './PointMap.jsx';

const propTypes = {
  layers: React.PropTypes.arrayOf(React.PropTypes.string),
  slice: React.PropTypes.object.isRequired,
  raiseError: React.PropTypes.func.isRequired,
};

class LayeredMapViz extends React.Component {
  constructor(props) {
    super(props);

    this.raiseChildError = this.raiseChildError.bind(this);
    this.slicesLoaded = false;
  }

  componentDidMount() {
    let uri = '/sliceaddview/api/read';
    if (this.props.slice.sliceCreatorId) {
      uri += '?_flt_0_created_by=' + this.props.slice.sliceCreatorId;
    }
    this.sliceIdsRequest = $.ajax({
      url: uri,
      type: 'GET',
      success: (response) => {
        const sliceMap = {};
        // Prepare slice data for table
        response.result.forEach(function (slice) {
          sliceMap[slice.data.slice_id] = slice.data.json_endpoint;
        });

        const deferreds = [];
        this.props.layers.forEach((sliceId) => {
          const jsonEndpoint = sliceMap[sliceId];
          if (jsonEndpoint === undefined) {
            this.props.raiseError('Slice id ' + sliceId + ' is invalid. Ensure the slice' +
              'exists and that the creator of Mapbox Layers is the same as slice ' + sliceId);
          }
          deferreds.push(this.getSliceJson(jsonEndpoint));
        }, this);

        this.slicesRequest = $.when.apply(null, deferreds)
          .done(function (...args) {
            const sliceArgs = [];

            if (deferreds.length === 1) {
              sliceArgs.push(args[0]);
            } else if (deferreds.length > 1) {
              for (let i = 0; i < args.length; i++) {
                sliceArgs.push(args[i][0]);
              }
            }

            this.slicesLoaded = true;
            this.setState({
              sliceArgs,
            });
          }.bind(this));
      },
      error: function (error) {
        this.props.raiseError('Getting a slice errored with "' + error + '"');
      }.bind(this),
    });
  }

  getSliceJson(jsonEndpoint) {
    return $.ajax({
      type: 'GET',
      url: jsonEndpoint,
      success: (json) => json.data,
      error: (error) => {
        this.props.raiseError(error.responseText);
        return null;
      },
    });
  }

  raiseChildError(e) {
    this.props.raiseError('One or more slice layers errored with "' + e + '"');
  }

  render() {
    if (!this.slicesLoaded || this.state.sliceArgs.length === 0) {
      return <div>Loading layers...</div>;
    }

    return (<div>
      {this.state.sliceArgs.map((args, i) => {
        if (args.form_data.viz_type === 'mapbox') {
          return (
            <PointMapRaw
              key={i}
              {...$.extend(args.data, this.props)}
              raiseError={this.raiseChildError}
            />
          );
        }
        return null;
      })}
    </div>);
  }
}

LayeredMapViz.propTypes = propTypes;

export default BaseMapWrapper(LayeredMapViz);

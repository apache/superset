/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import { PolygonLayer } from 'deck.gl';
import { flatten } from 'lodash';

import AnimatableDeckGLContainer from '../AnimatableDeckGLContainer';
import Legend from '../../Legend';
import { getCategories, getBreakPointColorScaler } from '../utils';

import * as common from './common';
import { getPlaySliderParams } from '../../../modules/time';
import sandboxedEval from '../../../modules/sandbox';

const DOUBLE_CLICK_TRESHOLD = 250;  // milliseconds

function getPoints(features) {
  return flatten(features.map(d => d.polygon), true);
}

function getElevation(d, colorScaler) {
  /* in deck.gl, if a polygon has opacity zero it will make everything behind
   * it have opacity zero, effectly showing the map layer no matter what other
   * polygons are behind it.
   */
  return colorScaler(d)[3] === 0
    ? 0
    : d.elevation;
}

function getLayer(formData, payload, slice, selected, onSelect, filters) {
  const fd = formData;
  const fc = fd.fill_color_picker;
  const sc = fd.stroke_color_picker;
  let data = [...payload.data.features];

  if (filters != null) {
    filters.forEach((f) => {
      data = data.filter(f);
    });
  }

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  const colorScaler = fd.metric === null
    ? d => [fc.r, fc.g, fc.b, 255 * fc.a]
    : getBreakPointColorScaler(fd, data);

  return new PolygonLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    pickable: true,
    filled: fd.filled,
    stroked: fd.stroked,
    getPolygon: d => d.polygon,
    getFillColor: colorScaler,
    getLineColor: [sc.r, sc.g, sc.b, 255 * sc.a],
    getLineWidth: fd.line_width,
    extruded: fd.extruded,
    getElevation: d => getElevation(d, colorScaler),
    elevationScale: fd.multiplier,
    fp64: true,
    ...common.commonLayerProps(fd, slice, onSelect),
  });
}

const propTypes = {
    slice: PropTypes.object.isRequired,
    payload: PropTypes.object.isRequired,
    setControlValue: PropTypes.func.isRequired,
    viewport: PropTypes.object.isRequired,
};

class DeckGLPolygon extends React.PureComponent {
  /* eslint-disable-next-line react/sort-comp */
  static getDerivedStateFromProps(nextProps) {
    const fd = nextProps.slice.formData;
    const features = nextProps.payload.data.features || [];

    const timeGrain = fd.time_grain_sqla || fd.granularity || 'PT1M';
    const timestamps = features.map(f => f.__timestamp);
    const {
      start,
      end,
      getStep,
      values,
      disabled,
    } = getPlaySliderParams(timestamps, timeGrain);
    const categories = getCategories(features, fd);

    return {
      start,
      end,
      getStep,
      values,
      disabled,
      categories,
    };
  }  constructor(props) {
    super(props);
    this.state = {
      ...DeckGLPolygon.getDerivedStateFromProps(props),
      selected: [],
      lastClick: 0,
      viewport: this.props.viewport,
    };

    this.getLayers = this.getLayers.bind(this);
    this.onSelect = this.onSelect.bind(this);
    this.onViewportChange = this.onViewportChange.bind(this);
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.payload !== this.props.payload) {
      this.setState(DeckGLPolygon.getDerivedStateFromProps(nextProps));
    }
  }
  onSelect(polygon) {
    const { slice } = this.props;
    const fd = slice.formData;

    const now = new Date();
    const doubleClick = (now - this.state.lastClick) <= DOUBLE_CLICK_TRESHOLD;

    // toggle selected polygons
    const selected = [...this.state.selected];
    if (doubleClick) {
      selected.splice(0, selected.length, polygon);
    } else if (fd.toggle_polygons) {
      const i = selected.indexOf(polygon);
      if (i === -1) {
        selected.push(polygon);
      } else {
        selected.splice(i, 1);
      }
    } else {
      selected.splice(0, 1, polygon);
    }

    this.setState({ selected, lastClick: now });
    if (fd.table_filter) {
      slice.addFilter(fd.line_column, selected, false, true);
    }
  }
  onViewportChange(viewport) {
    this.setState({ viewport });
  }
  getLayers(values) {
    if (this.props.payload.data.features === undefined) {
      return [];
    }

    const filters = [];

    // time filter
    if (values[0] === values[1] || values[1] === this.end) {
      filters.push(d => d.__timestamp >= values[0] && d.__timestamp <= values[1]);
    } else {
      filters.push(d => d.__timestamp >= values[0] && d.__timestamp < values[1]);
    }

    const layer = getLayer(
      this.props.slice.formData,
      this.props.payload,
      this.props.slice,
      this.state.selected,
      this.onSelect,
      filters);

    return [layer];
  }
  render() {
    return (
      <div style={{ position: 'relative' }}>
        <AnimatableDeckGLContainer
          getLayers={this.getLayers}
          start={this.state.start}
          end={this.state.end}
          getStep={this.state.getStep}
          values={this.state.values}
          disabled={this.state.disabled}
          viewport={this.state.viewport}
          onViewportChange={this.onViewportChange}
          mapboxApiAccessToken={this.props.payload.data.mapboxApiKey}
          mapStyle={this.props.slice.formData.mapbox_style}
          setControlValue={this.props.setControlValue}
          aggregation
        >
          {this.props.slice.formData.metric !== null &&
          <Legend
            categories={this.state.categories}
            position={this.props.slice.formData.legend_position}
          />}
        </AnimatableDeckGLContainer>
      </div>
    );
  }
}

DeckGLPolygon.propTypes = propTypes;

function deckPolygon(slice, payload, setControlValue) {
  const fd = slice.formData;
  let viewport = {
    ...fd.viewport,
    width: slice.width(),
    height: slice.height(),
  };

  if (fd.autozoom && payload.data.features) {
    viewport = common.fitViewport(viewport, getPoints(payload.data.features));
  }

  ReactDOM.render(
    <DeckGLPolygon
      slice={slice}
      payload={payload}
      setControlValue={setControlValue}
      viewport={viewport}
    />,
    document.getElementById(slice.containerId),
  );
}

module.exports = {
  default: deckPolygon,
  getLayer,
};

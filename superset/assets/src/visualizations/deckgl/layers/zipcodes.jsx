/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import { GeoJsonLayer } from 'deck.gl';

import AnimatableDeckGLContainer from '../AnimatableDeckGLContainer';
import Legend from '../../Legend';

import * as common from './common';
import { getPlaySliderParams } from '../../../modules/time';
import sandboxedEval from '../../../modules/sandbox';

const DOUBLE_CLICK_TRESHOLD = 250;  // milliseconds

function getPoints(geojson) {
  const points = [];
  Object.values(geojson).forEach((geometry) => {
    geometry.coordinates.forEach((polygon) => {
      polygon.forEach((coordinates) => {
        coordinates.forEach((point) => {
          points.push(point);
        });
      });
    });
  });
  return points;
}

function getRange(data) {
  let minValue = Infinity;
  let maxValue = -Infinity;
  data.forEach((d) => {
    if (d.zipcode !== '') {
      minValue = Math.min(minValue, d.metric);
      maxValue = Math.max(maxValue, d.metric);
    }
  });
  return [minValue, maxValue];
}

function getAlpha(value, breakPoints) {
  const i = breakPoints.map(point => point >= value).indexOf(true);
  return i === -1 ? 1 : i / (breakPoints.length - 1);
}

function getBreakPoints(fd, features) {
  if (fd.break_points === undefined || fd.break_points.length === 0) {
    const numCategories = parseInt(fd.num_categories, 10);
    const [minValue, maxValue] = getRange(features);
    const delta = (maxValue - minValue) / numCategories;
    const precision = Math.max(0, Math.floor(Math.log10(numCategories / delta)));
    return Array(numCategories + 1)
      .fill()
      .map((_, i) => (minValue + i * delta).toFixed(precision));
  }
  return fd.break_points.sort((a, b) => parseFloat(a) - parseFloat(b));
}

function getLayer(formData, payload, slice, selected, onSelect, filters) {
  const fd = formData;
  let data = payload.data.features.map(d => ({ ...d, geometry: payload.data.geojson[d.zipcode] }));
  data = data.filter(d => d.geometry !== undefined);

  if (filters != null) {
    filters.forEach((f) => {
      data = data.filter(f);
    });
  }

  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const breakPoints = getBreakPoints(fd, payload.data.features);
  data = data.map(d => ({
    ...d,
    properties: {
      color: [c.r, c.g, c.b, 255 * c.a * getAlpha(d.metric, breakPoints)],
      metric: d.metric,
      zipcode: d.zipcode,
    },
  }));

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  const layerProps = common.commonLayerProps(fd, slice);
  if (layerProps.onHover === undefined) {
    layerProps.pickable = true;
    layerProps.onHover = (o) => {
      if (o.picked) {
        slice.setTooltip({
          content: 'ZIP code: ' + o.object.zipcode + '<br />Metric: ' + o.object.metric,
          x: o.x,
          y: o.y,
        });
      } else {
        slice.setTooltip(null);
      }
    };
  }
  if (layerProps.onClick === undefined) {
    layerProps.onClick = o => onSelect(o.object.zipcode);
  }

  function getLineColor(d) {
    if (selected.indexOf(d.properties.zipcode) === -1) {
      return [0, 0, 0, 100];
    }
    return [255, 0, 0, 100];
  }

  function getLineWidth(d) {
    if (selected.indexOf(d.properties.zipcode) === -1) {
      return 1;
    }
    return 10;
  }

  return new GeoJsonLayer({
    id: `zipcodes-layer-${fd.slice_id}`,
    data,
    pickable: true,
    stroked: true,
    filled: true,
    extruded: false,
    lineWidthScale: 20,
    lineWidthMinPixels: 1,
    getFillColor: d => d.properties.color,
    getLineColor,
    getRadius: 100,
    getLineWidth,
    getElevation: 30,
    ...layerProps,
  });
}

function getCategories(features, fd) {
  const color = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const breakPoints = getBreakPoints(fd, features);
  const categories = {};
  breakPoints.slice(1).forEach((value, i) => {
    const range = breakPoints[i] + ' - ' + breakPoints[i + 1];
    const alpha = (i + 1) / (breakPoints.length - 1);
    categories[range] = {
      color: [color.r, color.g, color.b, alpha],
      enabled: true,
    };
  });
  return categories;
}

const propTypes = {
  slice: PropTypes.object.isRequired,
  payload: PropTypes.object.isRequired,
  setControlValue: PropTypes.func.isRequired,
  viewport: PropTypes.object.isRequired,
};

class DeckGLZipCodes extends React.PureComponent {
  /* eslint-disable-next-line react/sort-comp */
  static getDerivedStateFromProps(nextProps) {
    const fd = nextProps.slice.formData;
    const features = nextProps.payload.data.features || [];

    const timeGrain = fd.time_grain_sqla || fd.granularity || 'PT1M';
    const timestamps = features.map(f => f.__timestamp);
    const { start, end, getStep, values, disabled } = getPlaySliderParams(timestamps, timeGrain);
    const categories = getCategories(features, fd);

    return {
      start,
      end,
      getStep,
      values,
      disabled,
      categories,
    };
  }
  constructor(props) {
    super(props);
    this.state = {
      ...DeckGLZipCodes.getDerivedStateFromProps(props),
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
      this.setState(DeckGLZipCodes.getDerivedStateFromProps(nextProps));
    }
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
  onSelect(zipcode) {
    const { slice } = this.props;
    const fd = slice.formData;

    const now = new Date();
    const doubleClick = (now - this.state.lastClick) <= DOUBLE_CLICK_TRESHOLD;

    // toggle selected zipcodes
    const selected = [...this.state.selected];
    if (doubleClick) {
      selected.splice(0, selected.length, zipcode);
    } else if (fd.toggle_zipcodes) {
      const i = selected.indexOf(zipcode);
      if (i === -1) {
        selected.push(zipcode);
      } else {
        selected.splice(i, 1);
      }
    } else {
      selected.splice(0, 1, zipcode);
    }

    this.setState({ selected, lastClick: now });
    if (fd.propagate_filter) {
      slice.addFilter(fd.groupby, selected, false, true);
    }
  }
  onViewportChange(viewport) {
    this.setState({ viewport });
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
          <Legend
            categories={this.state.categories}
            position={this.props.slice.formData.legend_position}
          />
        </AnimatableDeckGLContainer>
      </div>
    );
  }
}

DeckGLZipCodes.propTypes = propTypes;

function deckZipCodes(slice, payload, setControlValue) {
  const fd = slice.formData;
  let viewport = {
    ...fd.viewport,
    width: slice.width(),
    height: slice.height(),
  };

  if (fd.autozoom && payload.data.geojson) {
    viewport = common.fitViewport(viewport, getPoints(payload.data.geojson));
  }

  ReactDOM.render(
    <DeckGLZipCodes
      slice={slice}
      payload={payload}
      setControlValue={setControlValue}
      viewport={viewport}
    />,
    document.getElementById(slice.containerId),
  );
}

module.exports = {
  default: deckZipCodes,
  getLayer,
};

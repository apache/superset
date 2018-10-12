/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import React from 'react';
import PropTypes from 'prop-types';
import { ScreenGridLayer } from 'deck.gl';
import AnimatableDeckGLContainer from '../AnimatableDeckGLContainer';
import { getPlaySliderParams } from '../../../modules/time';
import sandboxedEval from '../../../modules/sandbox';
import { commonLayerProps, fitViewport } from './common';
import createAdaptor from '../createAdaptor';

function getPoints(data) {
  return data.map(d => d.position);
}

export function getLayer(formData, payload, onAddFilter, onTooltip, filters) {
  const fd = formData;
  const c = fd.color_picker;
  let data = payload.data.features.map(d => ({
    ...d,
    color: [c.r, c.g, c.b, 255 * c.a],
  }));

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  if (filters != null) {
    filters.forEach((f) => {
      data = data.filter(f);
    });
  }

  // Passing a layer creator function instead of a layer since the
  // layer needs to be regenerated at each render
  return new ScreenGridLayer({
    id: `screengrid-layer-${fd.slice_id}`,
    data,
    pickable: true,
    cellSizePixels: fd.grid_size,
    minColor: [c.r, c.g, c.b, 0],
    maxColor: [c.r, c.g, c.b, 255 * c.a],
    outline: false,
    getWeight: d => d.weight || 0,
    ...commonLayerProps(fd, onAddFilter, onTooltip),
  });
}

const propTypes = {
  formData: PropTypes.object.isRequired,
  payload: PropTypes.object.isRequired,
  setControlValue: PropTypes.func.isRequired,
  viewport: PropTypes.object.isRequired,
  onAddFilter: PropTypes.func,
  onTooltip: PropTypes.func,
};
const defaultProps = {
  onAddFilter() {},
  onTooltip() {},
};

class DeckGLScreenGrid extends React.PureComponent {
  /* eslint-disable-next-line react/sort-comp */
  static getDerivedStateFromProps(nextProps) {
    const fd = nextProps.formData;

    const timeGrain = fd.time_grain_sqla || fd.granularity || 'PT1M';
    const timestamps = nextProps.payload.data.features.map(f => f.__timestamp);
    const { start, end, getStep, values, disabled } = getPlaySliderParams(timestamps, timeGrain);

    return { start, end, getStep, values, disabled };
  }
  constructor(props) {
    super(props);
    this.state = DeckGLScreenGrid.getDerivedStateFromProps(props);

    this.getLayers = this.getLayers.bind(this);
  }
  componentWillReceiveProps(nextProps) {
    this.setState(DeckGLScreenGrid.getDerivedStateFromProps(nextProps, this.state));
  }
  getLayers(values) {
    const filters = [];

    // time filter
    if (values[0] === values[1] || values[1] === this.end) {
      filters.push(d => d.__timestamp >= values[0] && d.__timestamp <= values[1]);
    } else {
      filters.push(d => d.__timestamp >= values[0] && d.__timestamp < values[1]);
    }

    const layer = getLayer(
      this.props.formData,
      this.props.payload,
      this.props.onAddFilter,
      this.props.onTooltip,
      filters);

    return [layer];
  }

  render() {
    const { formData, payload } = this.props;
    const viewport = formData.autozoom
      ? fitViewport(this.props.viewport, getPoints(payload.data.features))
      : this.props.viewport;

    return (
      <div>
        <AnimatableDeckGLContainer
          getLayers={this.getLayers}
          start={this.state.start}
          end={this.state.end}
          getStep={this.state.getStep}
          values={this.state.values}
          disabled={this.state.disabled}
          viewport={viewport}
          mapboxApiAccessToken={this.props.payload.data.mapboxApiKey}
          mapStyle={this.props.formData.mapbox_style}
          setControlValue={this.props.setControlValue}
          aggregation
        />
      </div>
    );
  }
}

DeckGLScreenGrid.propTypes = propTypes;
DeckGLScreenGrid.defaultProps = defaultProps;

export default createAdaptor(DeckGLScreenGrid);

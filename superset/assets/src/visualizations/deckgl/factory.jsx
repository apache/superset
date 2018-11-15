import React from 'react';
import PropTypes from 'prop-types';
import { isEqual } from 'lodash';

import DeckGLContainer from './DeckGLContainer';
import CategoricalDeckGLContainer from './CategoricalDeckGLContainer';
import { fitViewport } from './layers/common';

const propTypes = {
  formData: PropTypes.object.isRequired,
  payload: PropTypes.object.isRequired,
  setControlValue: PropTypes.func.isRequired,
  viewport: PropTypes.object.isRequired,
  onAddFilter: PropTypes.func,
  setTooltip: PropTypes.func,
};
const defaultProps = {
  onAddFilter() {},
  setTooltip() {},
};

export function createDeckGLComponent(getLayer, getPoints) {
  // Higher order component
  class Component extends React.PureComponent {
    constructor(props) {
      super(props);
      const originalViewport = props.viewport;
      const viewport = props.formData.autozoom
        ? fitViewport(originalViewport, getPoints(props.payload.data.features))
        : originalViewport;
      this.state = {
        viewport,
        layer: this.computeLayer(props),
      };
      this.onViewportChange = this.onViewportChange.bind(this);
    }
    componentWillReceiveProps(nextProps) {
      // Only recompute the layer if anything BUT the viewport has changed
      const nextFdNoVP = { ...nextProps.formData, viewport: null };
      const currFdNoVP = { ...this.props.formData, viewport: null };
      if (
        !isEqual(nextFdNoVP, currFdNoVP) ||
        nextProps.payload !== this.props.payload
      ) {
        this.setState({ layer: this.computeLayer(nextProps) });
      }
    }
    onViewportChange(viewport) {
      this.setState({ viewport });
    }
    computeLayer(props) {
      const {
        formData,
        payload,
        onAddFilter,
        setTooltip,
      } = props;
      return getLayer(formData, payload, onAddFilter, setTooltip);
    }
    render() {
      const {
        formData,
        payload,
        setControlValue,
      } = this.props;
      const {
        layer,
        viewport,
      } = this.state;
      return (
        <DeckGLContainer
          mapboxApiAccessToken={payload.data.mapboxApiKey}
          viewport={viewport}
          layers={[layer]}
          mapStyle={formData.mapbox_style}
          setControlValue={setControlValue}
          onViewportChange={this.onViewportChange}
        />);
    }
  }
  Component.propTypes = propTypes;
  Component.defaultProps = defaultProps;
  return Component;
}

export function createCategoricalDeckGLComponent(getLayer, getPoints) {
  function Component(props) {
    const {
      formData,
      payload,
      setControlValue,
      onAddFilter,
      setTooltip,
      viewport,
    } = props;

    return (
      <CategoricalDeckGLContainer
        formData={formData}
        mapboxApiKey={payload.data.mapboxApiKey}
        setControlValue={setControlValue}
        viewport={viewport}
        getLayer={getLayer}
        payload={payload}
        onAddFilter={onAddFilter}
        setTooltip={setTooltip}
        getPoints={getPoints}
      />
    );
  }

  Component.propTypes = propTypes;
  Component.defaultProps = defaultProps;

  return Component;
}

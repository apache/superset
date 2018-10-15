import React from 'react';
import PropTypes from 'prop-types';
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
  function Component(props) {
    const {
      formData,
      payload,
      setControlValue,
      onAddFilter,
      setTooltip,
      viewport: originalViewport,
    } = props;

    const viewport = formData.autozoom
      ? fitViewport(originalViewport, getPoints(payload.data.features))
      : originalViewport;

    const layer = getLayer(formData, payload, onAddFilter, setTooltip);

    return (
      <DeckGLContainer
        mapboxApiAccessToken={payload.data.mapboxApiKey}
        viewport={viewport}
        layers={[layer]}
        mapStyle={formData.mapbox_style}
        setControlValue={setControlValue}
      />
    );
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
      viewport: originalViewport,
    } = props;

    const viewport = formData.autozoom
      ? fitViewport(originalViewport, getPoints(payload.data.features))
      : originalViewport;

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
      />
    );
  }

  Component.propTypes = propTypes;
  Component.defaultProps = defaultProps;

  return Component;
}

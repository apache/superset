import React from 'react';
import DeckGLContainer from './DeckGLContainer';
import CategoricalDeckGLContainer from './CategoricalDeckGLContainer';
import { fitViewport } from './layers/common';

export function createDeckGLComponent(getLayer, getPoints) {
  function Component(props) {
    const {
      formData,
      payload,
      setControlValue,
      onAddFilter,
      onTooltip,
      viewport: originalViewport,
    } = props;

    const viewport = formData.autozoom
      ? fitViewport(originalViewport, getPoints(payload.data.features))
      : originalViewport;

    const layer = getLayer(formData, payload, onAddFilter, onTooltip);

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

  return Component;
}

export function createCategoricalDeckGLComponent(getLayer, getPoints) {
  function Component(props) {
    const {
      formData,
      payload,
      setControlValue,
      onAddFilter,
      onTooltip,
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
        onTooltip={onTooltip}
      />
    );
  }

  return Component;
}

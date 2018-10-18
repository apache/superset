import React from 'react';
import ReactDOM from 'react-dom';
import ChartProps from '../visualizations/core/models/ChartProps';

const IDENTITY = x => x;

export default function createAdaptor(Component, transformProps = IDENTITY) {
  return function adaptor(slice, payload, setControlValue) {
    const chartProps = new ChartProps({
      width: slice.width(),
      height: slice.height(),
      annotationData: slice.annotationData,
      datasource: slice.datasource,
      filters: slice.getFilters(),
      formData: slice.formData,
      onAddFilter(...args) {
        slice.addFilter(...args);
      },
      onError(...args) {
        slice.error(...args);
      },
      payload,
      setControlValue,
      setTooltip(...args) {
        slice.setTooltip(...args);
      },
    });

    ReactDOM.render(
      <Component {...transformProps(chartProps)} />,
      document.querySelector(slice.selector),
    );
  };
}

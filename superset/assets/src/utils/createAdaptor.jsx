import React from 'react';
import ReactDOM from 'react-dom';
import BasicChartInput from '../visualizations/models/BasicChartInput';

const IDENTITY = x => x;

export default function createAdaptor(Component, transformProps = IDENTITY) {
  return function adaptor(slice, payload, setControlValue) {
    const chartProps = new BasicChartInput(slice, payload, setControlValue);
    ReactDOM.render(
      <Component
        width={slice.width()}
        height={slice.height()}
        {...transformProps(chartProps)}
      />,
      document.querySelector(slice.selector),
    );
  };
}

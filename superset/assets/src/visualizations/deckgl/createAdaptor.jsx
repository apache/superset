import React from 'react';
import ReactDOM from 'react-dom';

const IDENTITY = x => x;

class DeckGlChartInput {
  constructor(slice, payload, setControlValue) {
    this.width = slice.width();
    this.height = slice.height();
    this.formData = slice.formData;
    this.payload = payload;
    this.setControlValue = setControlValue;
    this.onAddFilter = (...args) => { slice.addFilter(...args); };
    this.onTooltip = (...args) => { slice.tooltip(...args); }
  }
}

export default function createAdaptor(Component, transformProps = IDENTITY) {
  return function adaptor(slice, payload, setControlValue) {
    const chartInput = new DeckGlChartInput(slice, payload, setControlValue);
    ReactDOM.render(
      <Component {...transformProps(chartInput)} />,
      document.querySelector(slice.selector),
    );
  };
}

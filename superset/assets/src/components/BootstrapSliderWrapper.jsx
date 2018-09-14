import React from 'react';
import ReactBootstrapSlider from 'react-bootstrap-slider';
import 'bootstrap-slider/dist/css/bootstrap-slider.min.css';
import './BootstrapSliderWrapper.css';

export default function BootstrapSliderWrapper(props) {
  return (
    <span className="BootstrapSliderWrapper">
      <ReactBootstrapSlider {...props} />
    </span>
  );
}

import React from 'react';
import ReactDOM from 'react-dom';
import WorldMap from './ReactWorldMap';
import transformProps from './transformProps';

export default function adaptor(slice, payload) {
  ReactDOM.render(
    <WorldMap {...transformProps({ slice, payload })} />,
    document.querySelector(slice.selector),
  );
}

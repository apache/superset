import React from 'react';
import ReactDOM from 'react-dom';

const IDENTITY = x => x;

export default function createAdaptor(Component, transformProps = IDENTITY) {
  return function adaptor(slice, payload, setControlValue) {
    ReactDOM.render(
      <Component
        {...transformProps({
          slice,
          payload,
          setControlValue,
        })}
      />,
      document.querySelector(slice.selector),
    );
  };
}

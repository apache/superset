// @flow

import React, { type AbstractComponent } from 'react';
import { type InputProps } from '../components/Input';

// strip transition props off before spreading onto select component
// note we need to be explicit about innerRef for flow
const AnimatedInput = (
  WrappedComponent: AbstractComponent<InputProps>
): AbstractComponent<InputProps> => {
  return ({ in: inProp, onExited, appear, enter, exit, ...props }) => (
    <WrappedComponent {...props} />
  );
};

export default AnimatedInput;

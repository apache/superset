// @flow

import React, { type AbstractComponent } from 'react';
import { TransitionGroup } from 'react-transition-group';
import { type ValueContainerProps } from '../components/containers';

// make ValueContainer a transition group
const AnimatedValueContainer = (
  WrappedComponent: AbstractComponent<ValueContainerProps>
): AbstractComponent<ValueContainerProps> => (props) => (
  <TransitionGroup component={WrappedComponent} {...props} />
);

export default AnimatedValueContainer;

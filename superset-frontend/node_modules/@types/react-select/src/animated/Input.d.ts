import * as React from 'react';
import { InputProps } from '../components/Input';
import { BaseTransition } from './transitions';
import { PropsWithInnerRef } from '../types';

export type AnimatedInputProps = BaseTransition & PropsWithInnerRef & InputProps;

export function AnimatedInput(WrappedComponent: React.ComponentType<InputProps>): React.ComponentType<AnimatedInputProps>;

export default AnimatedInput;

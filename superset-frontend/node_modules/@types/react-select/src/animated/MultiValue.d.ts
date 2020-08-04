import { ComponentType } from 'react';
import { MultiValueProps } from '../components/MultiValue';
import { Collapse, fn } from './transitions';
import { OptionTypeBase } from '../types';

export type AnimatedMultiValueProps<OptionType extends OptionTypeBase> = {
  in: boolean,
  onExited: fn,
} & MultiValueProps<OptionType>;

export function AnimatedMultiValue<OptionType extends OptionTypeBase>(WrappedComponent: ComponentType<MultiValueProps<OptionType>>): ComponentType<AnimatedMultiValueProps<OptionType>>;

export default AnimatedMultiValue;

import { ComponentType } from 'react';
import { SingleValueProps } from '../components/SingleValue';
import { Fade } from './transitions';
import { OptionTypeBase } from '../types';

export type AnimatedSingleValueProps<OptionType extends OptionTypeBase> = SingleValueProps<OptionType>;

export function AnimatedSingleValue<OptionType extends OptionTypeBase>(WrappedComponent: ComponentType<SingleValueProps<OptionType>>): ComponentType<AnimatedSingleValueProps<OptionType>>;

export default AnimatedSingleValue;

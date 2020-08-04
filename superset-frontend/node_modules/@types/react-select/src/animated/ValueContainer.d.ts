import { ComponentType } from 'react';
import { TransitionGroup } from 'react-transition-group';
import { ValueContainerProps } from '../components/containers';
import { OptionTypeBase } from '../types';

export type AnimatedValueContainerProps<OptionType extends OptionTypeBase> = ValueContainerProps<OptionType>;

export function AnimatedValueContainer<OptionType extends OptionTypeBase>(WrappedComponent: ComponentType<ValueContainerProps<OptionType>>): ComponentType<AnimatedValueContainerProps<OptionType>>;

export default AnimatedValueContainer;

import { ComponentType } from 'react';
import { PlaceholderProps } from '../components/Placeholder';
import { Fade, collapseDuration } from './transitions';
import { OptionTypeBase } from '../types';

export type AnimatedPlaceholderProps<OptionType extends OptionTypeBase> = PlaceholderProps<OptionType>;

export function AnimatedPlaceholder<OptionType extends OptionTypeBase>(WrappedComponent: ComponentType<PlaceholderProps<OptionType>>): ComponentType<AnimatedPlaceholderProps<OptionType>>;

export default AnimatedPlaceholder;

import { ComponentType } from 'react';
import { SelectComponents, SelectComponentsConfig } from '../components/index';
import { default as AnimatedInput, AnimatedInputProps } from './Input';
import { default as AnimatedMultiValue, AnimatedMultiValueProps } from './MultiValue';
import { default as AnimatedPlaceholder, AnimatedPlaceholderProps } from './Placeholder';
import { default as AnimatedSingleValue, AnimatedSingleValueProps } from './SingleValue';
import { default as AnimatedValueContainer, AnimatedValueContainerProps } from './ValueContainer';
import { OptionTypeBase } from '../types';

export function makeAnimated<OptionType extends OptionTypeBase>(externalComponents?: SelectComponentsConfig<OptionType>): SelectComponents<OptionType>;

export const Input: ComponentType<AnimatedInputProps>;
export const MultiValue: ComponentType<AnimatedMultiValueProps<any>>;
export const Placeholder: ComponentType<AnimatedPlaceholderProps<any>>;
export const SingleValue: ComponentType<AnimatedSingleValueProps<any>>;
export const ValueContainer: ComponentType<AnimatedValueContainerProps<any>>;

export default makeAnimated;

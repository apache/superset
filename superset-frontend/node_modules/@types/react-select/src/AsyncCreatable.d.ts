import { Component, Ref as ElementRef } from 'react';
import { Props as AsyncProps, State as AsyncState } from './Async';
import { Props as CreatableProps, State as CreatableState } from './Creatable';
import { OptionsType, ValueType, ActionMeta, InputActionMeta, OptionTypeBase } from './types';
import { cleanValue } from './utils';

export type Props<OptionType extends OptionTypeBase> = AsyncProps<OptionType> & CreatableProps<OptionType>;

export type State<OptionType extends OptionTypeBase> = AsyncState<OptionType> & CreatableState<OptionType>;

export class AsyncCreatable<OptionType extends OptionTypeBase> extends Component<Props<OptionType>, State<OptionType>> {
    static defaultProps: Props<any>;
    select: ElementRef<any>;
    lastRequest: {};
    mounted: boolean;
    optionsCache: { [key: string]: OptionsType<OptionType> };

    focus(): void;
    blur(): void;
    loadOptions(inputValue: string, callback: (options: OptionsType<OptionType>) => void): void;
    handleInputChange: (newValue: string, actionMeta: InputActionMeta) => string;
    onChange: (newValue: ValueType<OptionType>, actionMeta: ActionMeta<OptionType>) => void;
}

export default AsyncCreatable;

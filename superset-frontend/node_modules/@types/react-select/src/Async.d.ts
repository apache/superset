import * as React from 'react';
import Select, { Props as SelectProps } from './Select';
import { handleInputChange } from './utils';
import manageState from './stateManager';
import { OptionsType, InputActionMeta, OptionTypeBase } from './types';

export interface AsyncProps<OptionType extends OptionTypeBase> {
  /* The default set of options to show before the user starts searching. When
     set to `true`, the results for loadOptions('') will be autoloaded.
     Default: false. */
  defaultOptions?: OptionsType<OptionType> | boolean;
  /* Function that returns a promise, which is the set of options to be used
     once the promise resolves. */
  loadOptions: (inputValue: string, callback: ((options: OptionsType<OptionType>) => void)) => Promise<any> | void;
  /* If cacheOptions is truthy, then the loaded data will be cached. The cache
     will remain until `cacheOptions` changes value.
     Default: false. */
  cacheOptions?: any;
}

export type Props<OptionType extends OptionTypeBase> = SelectProps<OptionType> & AsyncProps<OptionType>;

export const defaultProps: Props<any>;

export interface State<OptionType extends OptionTypeBase> {
  defaultOptions?: OptionsType<OptionType>;
  inputValue: string;
  isLoading: boolean;
  loadedInputValue?: string;
  loadedOptions: OptionsType<OptionType>;
  passEmptyOptions: boolean;
}

export class Async<OptionType extends OptionTypeBase> extends React.Component<Props<OptionType>, State<OptionType>> {
  static defaultProps: Props<any>;
  select: React.Ref<any>;
  lastRequest: {};
  mounted: boolean;
  optionsCache: { [key: string]: OptionsType<OptionType> };

  focus(): void;
  blur(): void;
  loadOptions(inputValue: string, callback: (options: OptionsType<OptionType>) => void): void;
  handleInputChange: (newValue: string, actionMeta: InputActionMeta) => string;
}

type ClassProps<T> = T extends new (props: infer P) => any ? P : never;
type FunctionProps<T> = T extends (props: infer P) => any ? P : never;

type SelectComponentProps<T> = T extends React.FunctionComponent<any>
    ? FunctionProps<T>
    : T extends React.ComponentClass<any> ? ClassProps<T> : never;

type AsyncComponentProps<T extends React.ComponentType<any> = React.ComponentType<any>> = SelectComponentProps<T> &
    AsyncProps<any>;

export function makeAsyncSelect<T extends React.ComponentType<any> = React.ComponentType<any>>(
    SelectComponent: T,
): React.ComponentClass<AsyncComponentProps<T>>;

export default Async;

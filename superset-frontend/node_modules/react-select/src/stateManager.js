// @flow

import React, {
  Component,
  type ElementRef,
  type AbstractComponent,
  type Config,
} from 'react';

import type { ActionMeta, InputActionMeta, ValueType } from './types';

export type DefaultProps = {|
  defaultInputValue: string,
  defaultMenuIsOpen: boolean,
  defaultValue: ValueType,
|};
export type Props = {
  ...DefaultProps,
  inputValue?: string,
  menuIsOpen?: boolean,
  value?: ValueType,
  onChange?: (ValueType, ActionMeta) => void,
};

type StateProps<P> = $Diff<
  P,
  {
    inputValue: any,
    value: any,
    menuIsOpen: any,
    onChange: any,
    onInputChange: any,
    onMenuClose: any,
    onMenuOpen: any,
  }
>;

type State = {
  inputValue: string,
  menuIsOpen: boolean,
  value: ValueType,
};

export const defaultProps = {
  defaultInputValue: '',
  defaultMenuIsOpen: false,
  defaultValue: null,
};

const manageState = <C: {}>(
  SelectComponent: AbstractComponent<C>
): AbstractComponent<StateProps<C> & Config<Props, DefaultProps>> =>
  class StateManager extends Component<StateProps<C> & Props, State> {
    static defaultProps: DefaultProps = defaultProps;

    select: ElementRef<*>;

    state = {
      inputValue:
        this.props.inputValue !== undefined
          ? this.props.inputValue
          : this.props.defaultInputValue,
      menuIsOpen:
        this.props.menuIsOpen !== undefined
          ? this.props.menuIsOpen
          : this.props.defaultMenuIsOpen,
      value:
        this.props.value !== undefined
          ? this.props.value
          : this.props.defaultValue,
    };
    focus() {
      this.select.focus();
    }
    blur() {
      this.select.blur();
    }
    // FIXME: untyped flow code, return any
    getProp(key: string) {
      return this.props[key] !== undefined ? this.props[key] : this.state[key];
    }
    // FIXME: untyped flow code, return any
    callProp(name: string, ...args: any) {
      if (typeof this.props[name] === 'function') {
        return this.props[name](...args);
      }
    }
    onChange = (value: any, actionMeta: ActionMeta) => {
      this.callProp('onChange', value, actionMeta);
      this.setState({ value });
    };
    onInputChange = (value: any, actionMeta: InputActionMeta) => {
      // TODO: for backwards compatibility, we allow the prop to return a new
      // value, but now inputValue is a controllable prop we probably shouldn't
      const newValue = this.callProp('onInputChange', value, actionMeta);
      this.setState({
        inputValue: newValue !== undefined ? newValue : value,
      });
    };
    onMenuOpen = () => {
      this.callProp('onMenuOpen');
      this.setState({ menuIsOpen: true });
    };
    onMenuClose = () => {
      this.callProp('onMenuClose');
      this.setState({ menuIsOpen: false });
    };
    render() {
      const {
        defaultInputValue,
        defaultMenuIsOpen,
        defaultValue,
        ...props
      } = this.props;
      return (
        <SelectComponent
          {...props}
          ref={ref => {
            this.select = ref;
          }}
          inputValue={this.getProp('inputValue')}
          menuIsOpen={this.getProp('menuIsOpen')}
          onChange={this.onChange}
          onInputChange={this.onInputChange}
          onMenuClose={this.onMenuClose}
          onMenuOpen={this.onMenuOpen}
          value={this.getProp('value')}
        />
      );
    }
  };

export default manageState;

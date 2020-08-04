// @flow

import React, { Component, type ElementRef, type Node } from 'react';
import memoizeOne from 'memoize-one';
import { MenuPlacer } from './components/Menu';
import isEqual from './internal/react-fast-compare';

import { createFilter } from './filters';
import {
  A11yText,
  DummyInput,
  ScrollBlock,
  ScrollCaptor,
} from './internal/index';
import {
  valueFocusAriaMessage,
  optionFocusAriaMessage,
  resultsAriaMessage,
  valueEventAriaMessage,
  instructionsAriaMessage,
  type InstructionsContext,
  type ValueEventContext,
} from './accessibility/index';

import {
  classNames,
  cleanValue,
  isTouchCapable,
  isMobileDevice,
  noop,
  scrollIntoView,
  isDocumentElement,
} from './utils';

import {
  formatGroupLabel,
  getOptionLabel,
  getOptionValue,
  isOptionDisabled,
} from './builtins';

import {
  defaultComponents,
  type PlaceholderOrValue,
  type SelectComponents,
  type SelectComponentsConfig,
} from './components/index';

import { defaultStyles, type StylesConfig } from './styles';
import { defaultTheme, type ThemeConfig } from './theme';

import type {
  ActionMeta,
  ActionTypes,
  FocusDirection,
  FocusEventHandler,
  GroupType,
  InputActionMeta,
  KeyboardEventHandler,
  MenuPlacement,
  MenuPosition,
  OptionsType,
  OptionType,
  ValueType,
} from './types';

type MouseOrTouchEvent =
  | SyntheticMouseEvent<HTMLElement>
  | SyntheticTouchEvent<HTMLElement>;
type FormatOptionLabelContext = 'menu' | 'value';
type FormatOptionLabelMeta = {
  context: FormatOptionLabelContext,
  inputValue: string,
  selectValue: ValueType,
};

export type Props = {
  /* Aria label (for assistive tech) */
  'aria-label'?: string,
  /* HTML ID of an element that should be used as the label (for assistive tech) */
  'aria-labelledby'?: string,
  /* Focus the control when it is mounted */
  autoFocus?: boolean,
  /* Remove the currently focused option when the user presses backspace */
  backspaceRemovesValue: boolean,
  /* Remove focus from the input when the user selects an option (handy for dismissing the keyboard on touch devices) */
  blurInputOnSelect: boolean,
  /* When the user reaches the top/bottom of the menu, prevent scroll on the scroll-parent  */
  captureMenuScroll: boolean,
  /* Sets a className attribute on the outer component */
  className?: string,
  /*
    If provided, all inner components will be given a prefixed className attribute.

    This is useful when styling via CSS classes instead of the Styles API approach.
  */
  classNamePrefix?: string | null,
  /* Close the select menu when the user selects an option */
  closeMenuOnSelect: boolean,
  /*
    If `true`, close the select menu when the user scrolls the document/body.

    If a function, takes a standard javascript `ScrollEvent` you return a boolean:

    `true` => The menu closes

    `false` => The menu stays open

    This is useful when you have a scrollable modal and want to portal the menu out,
    but want to avoid graphical issues.
   */
  closeMenuOnScroll: boolean | EventListener,
  /*
    This complex object includes all the compositional components that are used
    in `react-select`. If you wish to overwrite a component, pass in an object
    with the appropriate namespace.

    If you only wish to restyle a component, we recommend using the `styles` prop
    instead. For a list of the components that can be passed in, and the shape
    that will be passed to them, see [the components docs](/components)
  */
  components: SelectComponentsConfig,
  /* Whether the value of the select, e.g. SingleValue, should be displayed in the control. */
  controlShouldRenderValue: boolean,
  /* Delimiter used to join multiple values into a single HTML Input value */
  delimiter?: string,
  /* Clear all values when the user presses escape AND the menu is closed */
  escapeClearsValue: boolean,
  /* Custom method to filter whether an option should be displayed in the menu */
  filterOption:
    | (({ label: string, value: string, data: OptionType }, string) => boolean)
    | null,
  /*
    Formats group labels in the menu as React components

    An example can be found in the [Replacing builtins](/advanced#replacing-builtins) documentation.
  */
  formatGroupLabel: typeof formatGroupLabel,
  /* Formats option labels in the menu and control as React components */
  formatOptionLabel?: (OptionType, FormatOptionLabelMeta) => Node,
  /* Resolves option data to a string to be displayed as the label by components */
  getOptionLabel: typeof getOptionLabel,
  /* Resolves option data to a string to compare options and specify value attributes */
  getOptionValue: typeof getOptionValue,
  /* Hide the selected option from the menu */
  hideSelectedOptions?: boolean,
  /* The id to set on the SelectContainer component. */
  id?: string,
  /* The value of the search input */
  inputValue: string,
  /* The id of the search input */
  inputId?: string,
  /* Define an id prefix for the select components e.g. {your-id}-value */
  instanceId?: number | string,
  /* Is the select value clearable */
  isClearable?: boolean,
  /* Is the select disabled */
  isDisabled: boolean,
  /* Is the select in a state of loading (async) */
  isLoading: boolean,
  /*
    Override the built-in logic to detect whether an option is disabled

    An example can be found in the [Replacing builtins](/advanced#replacing-builtins) documentation.
  */
  isOptionDisabled: (OptionType, OptionsType) => boolean | false,
  /* Override the built-in logic to detect whether an option is selected */
  isOptionSelected?: (OptionType, OptionsType) => boolean,
  /* Support multiple selected options */
  isMulti: boolean,
  /* Is the select direction right-to-left */
  isRtl: boolean,
  /* Whether to enable search functionality */
  isSearchable: boolean,
  /* Async: Text to display when loading options */
  loadingMessage: ({ inputValue: string }) => string | null,
  /* Minimum height of the menu before flipping */
  minMenuHeight: number,
  /* Maximum height of the menu before scrolling */
  maxMenuHeight: number,
  /* Whether the menu is open */
  menuIsOpen: boolean,
  /* Default placement of the menu in relation to the control. 'auto' will flip
     when there isn't enough space below the control. */
  menuPlacement: MenuPlacement,
  /* The CSS position value of the menu, when "fixed" extra layout management is required */
  menuPosition: MenuPosition,
  /*
    Whether the menu should use a portal, and where it should attach

    An example can be found in the [Portaling](/advanced#portaling) documentation
  */
  menuPortalTarget?: HTMLElement,
  /* Whether to block scroll events when the menu is open */
  menuShouldBlockScroll: boolean,
  /* Whether the menu should be scrolled into view when it opens */
  menuShouldScrollIntoView: boolean,
  /* Name of the HTML Input (optional - without this, no input will be rendered) */
  name?: string,
  /* Text to display when there are no options */
  noOptionsMessage: ({ inputValue: string }) => Node | null,
  /* Handle blur events on the control */
  onBlur?: FocusEventHandler,
  /* Handle change events on the select */
  onChange: (ValueType, ActionMeta) => void,
  /* Handle focus events on the control */
  onFocus?: FocusEventHandler,
  /* Handle change events on the input */
  onInputChange: (string, InputActionMeta) => void,
  /* Handle key down events on the select */
  onKeyDown?: KeyboardEventHandler,
  /* Handle the menu opening */
  onMenuOpen: () => void,
  /* Handle the menu closing */
  onMenuClose: () => void,
  /* Fired when the user scrolls to the top of the menu */
  onMenuScrollToTop?: (SyntheticEvent<HTMLElement>) => void,
  /* Fired when the user scrolls to the bottom of the menu */
  onMenuScrollToBottom?: (SyntheticEvent<HTMLElement>) => void,
  /* Allows control of whether the menu is opened when the Select is focused */
  openMenuOnFocus: boolean,
  /* Allows control of whether the menu is opened when the Select is clicked */
  openMenuOnClick: boolean,
  /* Array of options that populate the select menu */
  options: OptionsType,
  /* Number of options to jump in menu when page{up|down} keys are used */
  pageSize: number,
  /* Placeholder for the select value */
  placeholder: Node,
  /* Status to relay to screen readers */
  screenReaderStatus: ({ count: number }) => string,
  /*
    Style modifier methods

    A basic example can be found at the bottom of the [Replacing builtins](/advanced#replacing-builtins) documentation.
  */
  styles: StylesConfig,
  /* Theme modifier method */
  theme?: ThemeConfig,
  /* Sets the tabIndex attribute on the input */
  tabIndex: string,
  /* Select the currently focused option when the user presses tab */
  tabSelectsValue: boolean,
  /* The value of the select; reflected by the selected option */
  value: ValueType,
};

export const defaultProps = {
  backspaceRemovesValue: true,
  blurInputOnSelect: isTouchCapable(),
  captureMenuScroll: !isTouchCapable(),
  closeMenuOnSelect: true,
  closeMenuOnScroll: false,
  components: {},
  controlShouldRenderValue: true,
  escapeClearsValue: false,
  filterOption: createFilter(),
  formatGroupLabel: formatGroupLabel,
  getOptionLabel: getOptionLabel,
  getOptionValue: getOptionValue,
  isDisabled: false,
  isLoading: false,
  isMulti: false,
  isRtl: false,
  isSearchable: true,
  isOptionDisabled: isOptionDisabled,
  loadingMessage: () => 'Loading...',
  maxMenuHeight: 300,
  minMenuHeight: 140,
  menuIsOpen: false,
  menuPlacement: 'bottom',
  menuPosition: 'absolute',
  menuShouldBlockScroll: false,
  menuShouldScrollIntoView: !isMobileDevice(),
  noOptionsMessage: () => 'No options',
  openMenuOnFocus: false,
  openMenuOnClick: true,
  options: [],
  pageSize: 5,
  placeholder: 'Select...',
  screenReaderStatus: ({ count }: { count: number }) =>
    `${count} result${count !== 1 ? 's' : ''} available`,
  styles: {},
  tabIndex: '0',
  tabSelectsValue: true,
};

type MenuOptions = {
  render: Array<OptionType>,
  focusable: Array<OptionType>,
};

type State = {
  ariaLiveSelection: string,
  ariaLiveContext: string,
  inputIsHidden: boolean,
  isFocused: boolean,
  focusedOption: OptionType | null,
  focusedValue: OptionType | null,
  menuOptions: MenuOptions,
  selectValue: OptionsType,
};

type ElRef = ElementRef<*>;

let instanceId = 1;

export default class Select extends Component<Props, State> {
  static defaultProps = defaultProps;
  state = {
    ariaLiveSelection: '',
    ariaLiveContext: '',
    focusedOption: null,
    focusedValue: null,
    inputIsHidden: false,
    isFocused: false,
    menuOptions: { render: [], focusable: [] },
    selectValue: [],
  };

  // Misc. Instance Properties
  // ------------------------------

  blockOptionHover: boolean = false;
  isComposing: boolean = false;
  clearFocusValueOnUpdate: boolean = false;
  commonProps: any; // TODO
  components: SelectComponents;
  hasGroups: boolean = false;
  initialTouchX: number = 0;
  initialTouchY: number = 0;
  inputIsHiddenAfterUpdate: ?boolean;
  instancePrefix: string = '';
  openAfterFocus: boolean = false;
  scrollToFocusedOptionOnUpdate: boolean = false;
  userIsDragging: ?boolean;

  // Refs
  // ------------------------------

  controlRef: ElRef = null;
  getControlRef = (ref: HTMLElement) => {
    this.controlRef = ref;
  };
  focusedOptionRef: ElRef = null;
  getFocusedOptionRef = (ref: HTMLElement) => {
    this.focusedOptionRef = ref;
  };
  menuListRef: ElRef = null;
  getMenuListRef = (ref: HTMLElement) => {
    this.menuListRef = ref;
  };
  inputRef: ElRef = null;
  getInputRef = (ref: HTMLElement) => {
    this.inputRef = ref;
  };

  // Lifecycle
  // ------------------------------

  constructor(props: Props) {
    super(props);
    const { value } = props;
    this.cacheComponents = memoizeOne(this.cacheComponents, isEqual).bind(this);
    this.cacheComponents(props.components);
    this.instancePrefix =
      'react-select-' + (this.props.instanceId || ++instanceId);

    const selectValue = cleanValue(value);

    this.buildMenuOptions = memoizeOne(
      this.buildMenuOptions,
      (newArgs: any, lastArgs: any) => {
        const [newProps, newSelectValue] = (newArgs: [Props, OptionsType]);
        const [lastProps, lastSelectValue] = (lastArgs: [Props, OptionsType]);

        return isEqual(newSelectValue, lastSelectValue)
          && isEqual(newProps.inputValue, lastProps.inputValue)
          && isEqual(newProps.options, lastProps.options);
      }).bind(this);
    const menuOptions = props.menuIsOpen
      ? this.buildMenuOptions(props, selectValue)
      : { render: [], focusable: [] };

    this.state.menuOptions = menuOptions;
    this.state.selectValue = selectValue;
  }
  componentDidMount() {
    this.startListeningComposition();
    this.startListeningToTouch();

    if (this.props.closeMenuOnScroll && document && document.addEventListener) {
      // Listen to all scroll events, and filter them out inside of 'onScroll'
      document.addEventListener('scroll', this.onScroll, true);
    }

    if (this.props.autoFocus) {
      this.focusInput();
    }
  }
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const { options, value, menuIsOpen, inputValue } = this.props;
    // re-cache custom components
    this.cacheComponents(nextProps.components);
    // rebuild the menu options
    if (
      nextProps.value !== value ||
      nextProps.options !== options ||
      nextProps.menuIsOpen !== menuIsOpen ||
      nextProps.inputValue !== inputValue
    ) {
      const selectValue = cleanValue(nextProps.value);
      const menuOptions = nextProps.menuIsOpen
        ? this.buildMenuOptions(nextProps, selectValue)
        : { render: [], focusable: [] };
      const focusedValue = this.getNextFocusedValue(selectValue);
      const focusedOption = this.getNextFocusedOption(menuOptions.focusable);
      this.setState({ menuOptions, selectValue, focusedOption, focusedValue });
    }
    // some updates should toggle the state of the input visibility
    if (this.inputIsHiddenAfterUpdate != null) {
      this.setState({
        inputIsHidden: this.inputIsHiddenAfterUpdate,
      });
      delete this.inputIsHiddenAfterUpdate;
    }
  }
  componentDidUpdate(prevProps: Props) {
    const { isDisabled, menuIsOpen } = this.props;
    const { isFocused } = this.state;

    if (
      // ensure focus is restored correctly when the control becomes enabled
      (isFocused && !isDisabled && prevProps.isDisabled) ||
      // ensure focus is on the Input when the menu opens
      (isFocused && menuIsOpen && !prevProps.menuIsOpen)
    ) {
      this.focusInput();
    }

    // scroll the focused option into view if necessary
    if (
      this.menuListRef &&
      this.focusedOptionRef &&
      this.scrollToFocusedOptionOnUpdate
    ) {
      scrollIntoView(this.menuListRef, this.focusedOptionRef);
      this.scrollToFocusedOptionOnUpdate = false;
    }
  }
  componentWillUnmount() {
    this.stopListeningComposition();
    this.stopListeningToTouch();
    document.removeEventListener('scroll', this.onScroll, true);
  }
  cacheComponents = (components: SelectComponents) => {
    this.components = defaultComponents({ components });
  };
  // ==============================
  // Consumer Handlers
  // ==============================

  onMenuOpen() {
    this.props.onMenuOpen();
  }
  onMenuClose() {
    const { isSearchable, isMulti } = this.props;
    this.announceAriaLiveContext({
      event: 'input',
      context: { isSearchable, isMulti },
    });
    this.onInputChange('', { action: 'menu-close' });
    this.props.onMenuClose();
  }
  onInputChange(newValue: string, actionMeta: InputActionMeta) {
    this.props.onInputChange(newValue, actionMeta);
  }

  // ==============================
  // Methods
  // ==============================

  focusInput() {
    if (!this.inputRef) return;
    this.inputRef.focus();
  }
  blurInput() {
    if (!this.inputRef) return;
    this.inputRef.blur();
  }

  // aliased for consumers
  focus = this.focusInput;
  blur = this.blurInput;

  openMenu(focusOption: 'first' | 'last') {
    const { selectValue, isFocused } = this.state;
    const menuOptions = this.buildMenuOptions(this.props, selectValue);
    const { isMulti } = this.props;
    let openAtIndex =
      focusOption === 'first' ? 0 : menuOptions.focusable.length - 1;

    if (!isMulti) {
      const selectedIndex = menuOptions.focusable.indexOf(selectValue[0]);
      if (selectedIndex > -1) {
        openAtIndex = selectedIndex;
      }
    }

    // only scroll if the menu isn't already open
    this.scrollToFocusedOptionOnUpdate = !(isFocused && this.menuListRef);
    this.inputIsHiddenAfterUpdate = false;

    this.setState({
      menuOptions,
      focusedValue: null,
      focusedOption: menuOptions.focusable[openAtIndex],
    }, () => {
      this.onMenuOpen();
      this.announceAriaLiveContext({ event: 'menu' });
    });
  }
  focusValue(direction: 'previous' | 'next') {
    const { isMulti, isSearchable } = this.props;
    const { selectValue, focusedValue } = this.state;

    // Only multiselects support value focusing
    if (!isMulti) return;

    this.setState({
      focusedOption: null,
    });

    let focusedIndex = selectValue.indexOf(focusedValue);
    if (!focusedValue) {
      focusedIndex = -1;
      this.announceAriaLiveContext({ event: 'value' });
    }

    const lastIndex = selectValue.length - 1;
    let nextFocus = -1;
    if (!selectValue.length) return;

    switch (direction) {
      case 'previous':
        if (focusedIndex === 0) {
          // don't cycle from the start to the end
          nextFocus = 0;
        } else if (focusedIndex === -1) {
          // if nothing is focused, focus the last value first
          nextFocus = lastIndex;
        } else {
          nextFocus = focusedIndex - 1;
        }
        break;
      case 'next':
        if (focusedIndex > -1 && focusedIndex < lastIndex) {
          nextFocus = focusedIndex + 1;
        }
        break;
    }

    if (nextFocus === -1) {
      this.announceAriaLiveContext({
        event: 'input',
        context: { isSearchable, isMulti },
      });
    }

    this.setState({
      inputIsHidden: nextFocus !== -1,
      focusedValue: selectValue[nextFocus],
    });
  }

  focusOption(direction: FocusDirection = 'first') {
    const { pageSize } = this.props;
    const { focusedOption, menuOptions } = this.state;
    const options = menuOptions.focusable;

    if (!options.length) return;
    let nextFocus = 0; // handles 'first'
    let focusedIndex = options.indexOf(focusedOption);
    if (!focusedOption) {
      focusedIndex = -1;
      this.announceAriaLiveContext({ event: 'menu' });
    }

    if (direction === 'up') {
      nextFocus = focusedIndex > 0 ? focusedIndex - 1 : options.length - 1;
    } else if (direction === 'down') {
      nextFocus = (focusedIndex + 1) % options.length;
    } else if (direction === 'pageup') {
      nextFocus = focusedIndex - pageSize;
      if (nextFocus < 0) nextFocus = 0;
    } else if (direction === 'pagedown') {
      nextFocus = focusedIndex + pageSize;
      if (nextFocus > options.length - 1) nextFocus = options.length - 1;
    } else if (direction === 'last') {
      nextFocus = options.length - 1;
    }
    this.scrollToFocusedOptionOnUpdate = true;
    this.setState({
      focusedOption: options[nextFocus],
      focusedValue: null,
    });
    this.announceAriaLiveContext({
      event: 'menu',
      context: { isDisabled: isOptionDisabled(options[nextFocus]) },
    });
  }
  onChange = (newValue: ValueType, actionMeta: ActionMeta) => {
    const { onChange, name } = this.props;
    onChange(newValue, { ...actionMeta, name });
  };
  setValue = (
    newValue: ValueType,
    action: ActionTypes = 'set-value',
    option?: OptionType
  ) => {
    const { closeMenuOnSelect, isMulti } = this.props;
    this.onInputChange('', { action: 'set-value' });
    if (closeMenuOnSelect) {
      this.inputIsHiddenAfterUpdate = !isMulti;
      this.onMenuClose();
    }
    // when the select value should change, we should reset focusedValue
    this.clearFocusValueOnUpdate = true;
    this.onChange(newValue, { action, option });
  };
  selectOption = (newValue: OptionType) => {
    const { blurInputOnSelect, isMulti } = this.props;
    const { selectValue } = this.state;

    if (isMulti) {
      if (this.isOptionSelected(newValue, selectValue)) {
        const candidate = this.getOptionValue(newValue);
        this.setValue(
          selectValue.filter(i => this.getOptionValue(i) !== candidate),
          'deselect-option',
          newValue
        );
        this.announceAriaLiveSelection({
          event: 'deselect-option',
          context: { value: this.getOptionLabel(newValue) },
        });
      } else {
        if (!this.isOptionDisabled(newValue, selectValue)) {
          this.setValue([...selectValue, newValue], 'select-option', newValue);
          this.announceAriaLiveSelection({
            event: 'select-option',
            context: { value: this.getOptionLabel(newValue) },
          });
        } else {
          // announce that option is disabled
          this.announceAriaLiveSelection({
            event: 'select-option',
            context: { value: this.getOptionLabel(newValue), isDisabled: true },
          });
        }
      }
    } else {
      if (!this.isOptionDisabled(newValue, selectValue)) {
        this.setValue(newValue, 'select-option');
        this.announceAriaLiveSelection({
          event: 'select-option',
          context: { value: this.getOptionLabel(newValue) },
        });
      } else {
        // announce that option is disabled
        this.announceAriaLiveSelection({
          event: 'select-option',
          context: { value: this.getOptionLabel(newValue), isDisabled: true },
        });
      }
    }

    if (blurInputOnSelect) {
      this.blurInput();
    }
  };
  removeValue = (removedValue: OptionType) => {
    const { selectValue } = this.state;
    const candidate = this.getOptionValue(removedValue);
    const newValue = selectValue.filter(
      i => this.getOptionValue(i) !== candidate
    );
    this.onChange(newValue.length ? newValue : null, {
      action: 'remove-value',
      removedValue,
    });
    this.announceAriaLiveSelection({
      event: 'remove-value',
      context: {
        value: removedValue ? this.getOptionLabel(removedValue) : '',
      },
    });
    this.focusInput();
  };
  clearValue = () => {
    const { isMulti } = this.props;
    this.onChange(isMulti ? [] : null, { action: 'clear' });
  };
  popValue = () => {
    const { selectValue } = this.state;
    const lastSelectedValue = selectValue[selectValue.length - 1];
    const newValue = selectValue.slice(0, selectValue.length - 1);
    this.announceAriaLiveSelection({
      event: 'pop-value',
      context: {
        value: lastSelectedValue ? this.getOptionLabel(lastSelectedValue) : '',
      },
    });
    this.onChange(newValue.length ? newValue : null, {
      action: 'pop-value',
      removedValue: lastSelectedValue,
    });
  };

  // ==============================
  // Getters
  // ==============================

  getTheme() {
    // Use the default theme if there are no customizations.
    if (!this.props.theme) {
      return defaultTheme;
    }
    // If the theme prop is a function, assume the function
    // knows how to merge the passed-in default theme with
    // its own modifications.
    if (typeof this.props.theme === 'function') {
      return this.props.theme(defaultTheme);
    }
    // Otherwise, if a plain theme object was passed in,
    // overlay it with the default theme.
    return {
      ...defaultTheme,
      ...this.props.theme,
    };
  }

  getCommonProps() {
    const { clearValue, getStyles, setValue, selectOption, props } = this;
    const { classNamePrefix, isMulti, isRtl, options } = props;
    const { selectValue } = this.state;
    const hasValue = this.hasValue();
    const getValue = () => selectValue;

    const cx = classNames.bind(null, classNamePrefix);
    return {
      cx,
      clearValue,
      getStyles,
      getValue,
      hasValue,
      isMulti,
      isRtl,
      options,
      selectOption,
      setValue,
      selectProps: props,
      theme: this.getTheme(),
    };
  }

  getNextFocusedValue(nextSelectValue: OptionsType) {
    if (this.clearFocusValueOnUpdate) {
      this.clearFocusValueOnUpdate = false;
      return null;
    }
    const { focusedValue, selectValue: lastSelectValue } = this.state;
    const lastFocusedIndex = lastSelectValue.indexOf(focusedValue);
    if (lastFocusedIndex > -1) {
      const nextFocusedIndex = nextSelectValue.indexOf(focusedValue);
      if (nextFocusedIndex > -1) {
        // the focused value is still in the selectValue, return it
        return focusedValue;
      } else if (lastFocusedIndex < nextSelectValue.length) {
        // the focusedValue is not present in the next selectValue array by
        // reference, so return the new value at the same index
        return nextSelectValue[lastFocusedIndex];
      }
    }
    return null;
  }

  getNextFocusedOption(options: OptionsType) {
    const { focusedOption: lastFocusedOption } = this.state;
    return lastFocusedOption && options.indexOf(lastFocusedOption) > -1
      ? lastFocusedOption
      : options[0];
  }
  getOptionLabel = (data: OptionType): string => {
    return this.props.getOptionLabel(data);
  };
  getOptionValue = (data: OptionType): string => {
    return this.props.getOptionValue(data);
  };
  getStyles = (key: string, props: {}): {} => {
    const base = defaultStyles[key](props);
    base.boxSizing = 'border-box';
    const custom = this.props.styles[key];
    return custom ? custom(base, props) : base;
  };
  getElementId = (element: 'group' | 'input' | 'listbox' | 'option') => {
    return `${this.instancePrefix}-${element}`;
  };
  getActiveDescendentId = () => {
    const { menuIsOpen } = this.props;
    const { menuOptions, focusedOption } = this.state;

    if (!focusedOption || !menuIsOpen) return undefined;

    const index = menuOptions.focusable.indexOf(focusedOption);
    const option = menuOptions.render[index];

    return option && option.key;
  };

  // ==============================
  // Helpers
  // ==============================
  announceAriaLiveSelection = ({
    event,
    context,
  }: {
    event: string,
    context: ValueEventContext,
  }) => {
    this.setState({
      ariaLiveSelection: valueEventAriaMessage(event, context),
    });
  };
  announceAriaLiveContext = ({
    event,
    context,
  }: {
    event: string,
    context?: InstructionsContext,
  }) => {
    this.setState({
      ariaLiveContext: instructionsAriaMessage(event, {
        ...context,
        label: this.props['aria-label'],
      }),
    });
  };

  hasValue() {
    const { selectValue } = this.state;
    return selectValue.length > 0;
  }
  hasOptions() {
    return !!this.state.menuOptions.render.length;
  }
  countOptions() {
    return this.state.menuOptions.focusable.length;
  }
  isClearable(): boolean {
    const { isClearable, isMulti } = this.props;

    // single select, by default, IS NOT clearable
    // multi select, by default, IS clearable
    if (isClearable === undefined) return isMulti;

    return isClearable;
  }
  isOptionDisabled(option: OptionType, selectValue: OptionsType): boolean {
    return typeof this.props.isOptionDisabled === 'function'
      ? this.props.isOptionDisabled(option, selectValue)
      : false;
  }
  isOptionSelected(option: OptionType, selectValue: OptionsType): boolean {
    if (selectValue.indexOf(option) > -1) return true;
    if (typeof this.props.isOptionSelected === 'function') {
      return this.props.isOptionSelected(option, selectValue);
    }
    const candidate = this.getOptionValue(option);
    return selectValue.some(i => this.getOptionValue(i) === candidate);
  }
  filterOption(
    option: { label: string, value: string, data: OptionType },
    inputValue: string
  ) {
    return this.props.filterOption
      ? this.props.filterOption(option, inputValue)
      : true;
  }
  formatOptionLabel(data: OptionType, context: FormatOptionLabelContext): Node {
    if (typeof this.props.formatOptionLabel === 'function') {
      const { inputValue } = this.props;
      const { selectValue } = this.state;
      return this.props.formatOptionLabel(data, {
        context,
        inputValue,
        selectValue,
      });
    } else {
      return this.getOptionLabel(data);
    }
  }
  formatGroupLabel(data: GroupType) {
    return this.props.formatGroupLabel(data);
  }

  // ==============================
  // Mouse Handlers
  // ==============================

  onMenuMouseDown = (event: SyntheticMouseEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    this.focusInput();
  };
  onMenuMouseMove = (event: SyntheticMouseEvent<HTMLElement>) => {
    this.blockOptionHover = false;
  };
  onControlMouseDown = (event: MouseOrTouchEvent) => {
    const { openMenuOnClick } = this.props;
    if (!this.state.isFocused) {
      if (openMenuOnClick) {
        this.openAfterFocus = true;
      }
      this.focusInput();
    } else if (!this.props.menuIsOpen) {
      if (openMenuOnClick) {
        this.openMenu('first');
      }
    } else {
      if (
        // $FlowFixMe
        event.target.tagName !== 'INPUT' &&
        event.target.tagName !== 'TEXTAREA'
      ) {
        this.onMenuClose();
      }
    }
    if (
      // $FlowFixMe
      event.target.tagName !== 'INPUT' &&
      event.target.tagName !== 'TEXTAREA'
    ) {
      event.preventDefault();
    }
  };
  onDropdownIndicatorMouseDown = (event: MouseOrTouchEvent) => {
    // ignore mouse events that weren't triggered by the primary button
    if (event && event.type === 'mousedown' && event.button !== 0) {
      return;
    }
    if (this.props.isDisabled) return;
    const { isMulti, menuIsOpen } = this.props;
    this.focusInput();
    if (menuIsOpen) {
      this.inputIsHiddenAfterUpdate = !isMulti;
      this.onMenuClose();
    } else {
      this.openMenu('first');
    }
    event.preventDefault();
    event.stopPropagation();
  };
  onClearIndicatorMouseDown = (event: MouseOrTouchEvent) => {
    // ignore mouse events that weren't triggered by the primary button
    if (event && event.type === 'mousedown' && event.button !== 0) {
      return;
    }
    this.clearValue();
    event.stopPropagation();
    this.openAfterFocus = false;
    if (event.type === 'touchend') {
      this.focusInput();
    } else {
      setTimeout(() => this.focusInput());
    }
  };
  onScroll = (event: Event) => {
    if (typeof this.props.closeMenuOnScroll === 'boolean') {
      if (
        event.target instanceof HTMLElement &&
        isDocumentElement(event.target)
      ) {
        this.props.onMenuClose();
      }
    } else if (typeof this.props.closeMenuOnScroll === 'function') {
      if (this.props.closeMenuOnScroll(event)) {
        this.props.onMenuClose();
      }
    }
  };

  // ==============================
  // Composition Handlers
  // ==============================

  startListeningComposition() {
    if (document && document.addEventListener) {
      document.addEventListener(
        'compositionstart',
        this.onCompositionStart,
        false
      );
      document.addEventListener('compositionend', this.onCompositionEnd, false);
    }
  }
  stopListeningComposition() {
    if (document && document.removeEventListener) {
      document.removeEventListener('compositionstart', this.onCompositionStart);
      document.removeEventListener('compositionend', this.onCompositionEnd);
    }
  }
  onCompositionStart = () => {
    this.isComposing = true;
  };
  onCompositionEnd = () => {
    this.isComposing = false;
  };

  // ==============================
  // Touch Handlers
  // ==============================

  startListeningToTouch() {
    if (document && document.addEventListener) {
      document.addEventListener('touchstart', this.onTouchStart, false);
      document.addEventListener('touchmove', this.onTouchMove, false);
      document.addEventListener('touchend', this.onTouchEnd, false);
    }
  }
  stopListeningToTouch() {
    if (document && document.removeEventListener) {
      document.removeEventListener('touchstart', this.onTouchStart);
      document.removeEventListener('touchmove', this.onTouchMove);
      document.removeEventListener('touchend', this.onTouchEnd);
    }
  }
  onTouchStart = ({ touches }: TouchEvent) => {
    const touch = touches.item(0);
    if (!touch) {
      return;
    }

    this.initialTouchX = touch.clientX;
    this.initialTouchY = touch.clientY;
    this.userIsDragging = false;
  };
  onTouchMove = ({ touches }: TouchEvent) => {
    const touch = touches.item(0);
    if (!touch) {
      return;
    }

    const deltaX = Math.abs(touch.clientX - this.initialTouchX);
    const deltaY = Math.abs(touch.clientY - this.initialTouchY);
    const moveThreshold = 5;

    this.userIsDragging = deltaX > moveThreshold || deltaY > moveThreshold;
  };
  onTouchEnd = (event: TouchEvent) => {
    if (this.userIsDragging) return;

    // close the menu if the user taps outside
    // we're checking on event.target here instead of event.currentTarget, because we want to assert information
    // on events on child elements, not the document (which we've attached this handler to).
    if (
      this.controlRef &&
      !this.controlRef.contains(event.target) &&
      this.menuListRef &&
      !this.menuListRef.contains(event.target)
    ) {
      this.blurInput();
    }

    // reset move vars
    this.initialTouchX = 0;
    this.initialTouchY = 0;
  };
  onControlTouchEnd = (event: SyntheticTouchEvent<HTMLElement>) => {
    if (this.userIsDragging) return;
    this.onControlMouseDown(event);
  };
  onClearIndicatorTouchEnd = (event: SyntheticTouchEvent<HTMLElement>) => {
    if (this.userIsDragging) return;

    this.onClearIndicatorMouseDown(event);
  };
  onDropdownIndicatorTouchEnd = (event: SyntheticTouchEvent<HTMLElement>) => {
    if (this.userIsDragging) return;

    this.onDropdownIndicatorMouseDown(event);
  };

  // ==============================
  // Focus Handlers
  // ==============================

  handleInputChange = (event: SyntheticKeyboardEvent<HTMLInputElement>) => {
    const inputValue = event.currentTarget.value;
    this.inputIsHiddenAfterUpdate = false;
    this.onInputChange(inputValue, { action: 'input-change' });
    this.onMenuOpen();
  };
  onInputFocus = (event: SyntheticFocusEvent<HTMLInputElement>) => {
    const { isSearchable, isMulti } = this.props;
    if (this.props.onFocus) {
      this.props.onFocus(event);
    }
    this.inputIsHiddenAfterUpdate = false;
    this.announceAriaLiveContext({
      event: 'input',
      context: { isSearchable, isMulti },
    });
    this.setState({
      isFocused: true,
    });
    if (this.openAfterFocus || this.props.openMenuOnFocus) {
      this.openMenu('first');
    }
    this.openAfterFocus = false;
  };
  onInputBlur = (event: SyntheticFocusEvent<HTMLInputElement>) => {
    if (this.menuListRef && this.menuListRef.contains(document.activeElement)) {
      this.inputRef.focus();
      return;
    }
    if (this.props.onBlur) {
      this.props.onBlur(event);
    }
    this.onInputChange('', { action: 'input-blur' });
    this.onMenuClose();
    this.setState({
      focusedValue: null,
      isFocused: false,
    });
  };
  onOptionHover = (focusedOption: OptionType) => {
    if (this.blockOptionHover || this.state.focusedOption === focusedOption) {
      return;
    }
    this.setState({ focusedOption });
  };
  shouldHideSelectedOptions = () => {
    const { hideSelectedOptions, isMulti } = this.props;
    if (hideSelectedOptions === undefined) return isMulti;
    return hideSelectedOptions;
  };

  // ==============================
  // Keyboard Handlers
  // ==============================

  onKeyDown = (event: SyntheticKeyboardEvent<HTMLElement>) => {
    const {
      isMulti,
      backspaceRemovesValue,
      escapeClearsValue,
      inputValue,
      isClearable,
      isDisabled,
      menuIsOpen,
      onKeyDown,
      tabSelectsValue,
      openMenuOnFocus,
    } = this.props;
    const { focusedOption, focusedValue, selectValue } = this.state;

    if (isDisabled) return;

    if (typeof onKeyDown === 'function') {
      onKeyDown(event);
      if (event.defaultPrevented) {
        return;
      }
    }

    // Block option hover events when the user has just pressed a key
    this.blockOptionHover = true;
    switch (event.key) {
      case 'ArrowLeft':
        if (!isMulti || inputValue) return;
        this.focusValue('previous');
        break;
      case 'ArrowRight':
        if (!isMulti || inputValue) return;
        this.focusValue('next');
        break;
      case 'Delete':
      case 'Backspace':
        if (inputValue) return;
        if (focusedValue) {
          this.removeValue(focusedValue);
        } else {
          if (!backspaceRemovesValue) return;
          if (isMulti) {
            this.popValue();
          } else if (isClearable) {
            this.clearValue();
          }
        }
        break;
      case 'Tab':
        if (this.isComposing) return;

        if (
          event.shiftKey ||
          !menuIsOpen ||
          !tabSelectsValue ||
          !focusedOption ||
          // don't capture the event if the menu opens on focus and the focused
          // option is already selected; it breaks the flow of navigation
          (openMenuOnFocus && this.isOptionSelected(focusedOption, selectValue))
        ) {
          return;
        }
        this.selectOption(focusedOption);
        break;
      case 'Enter':
        if (event.keyCode === 229) {
          // ignore the keydown event from an Input Method Editor(IME)
          // ref. https://www.w3.org/TR/uievents/#determine-keydown-keyup-keyCode
          break;
        }
        if (menuIsOpen) {
          if (!focusedOption) return;
          if (this.isComposing) return;
          this.selectOption(focusedOption);
          break;
        }
        return;
      case 'Escape':
        if (menuIsOpen) {
          this.inputIsHiddenAfterUpdate = false;
          this.onInputChange('', { action: 'menu-close' });
          this.onMenuClose();
        } else if (isClearable && escapeClearsValue) {
          this.clearValue();
        }
        break;
      case ' ': // space
        if (inputValue) {
          return;
        }
        if (!menuIsOpen) {
          this.openMenu('first');
          break;
        }
        if (!focusedOption) return;
        this.selectOption(focusedOption);
        break;
      case 'ArrowUp':
        if (menuIsOpen) {
          this.focusOption('up');
        } else {
          this.openMenu('last');
        }
        break;
      case 'ArrowDown':
        if (menuIsOpen) {
          this.focusOption('down');
        } else {
          this.openMenu('first');
        }
        break;
      case 'PageUp':
        if (!menuIsOpen) return;
        this.focusOption('pageup');
        break;
      case 'PageDown':
        if (!menuIsOpen) return;
        this.focusOption('pagedown');
        break;
      case 'Home':
        if (!menuIsOpen) return;
        this.focusOption('first');
        break;
      case 'End':
        if (!menuIsOpen) return;
        this.focusOption('last');
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  // ==============================
  // Menu Options
  // ==============================

  buildMenuOptions = (props: Props, selectValue: OptionsType): MenuOptions => {
    const { inputValue = '', options } = props;

    const toOption = (option, id) => {
      const isDisabled = this.isOptionDisabled(option, selectValue);
      const isSelected = this.isOptionSelected(option, selectValue);
      const label = this.getOptionLabel(option);
      const value = this.getOptionValue(option);

      if (
        (this.shouldHideSelectedOptions() && isSelected) ||
        !this.filterOption({ label, value, data: option }, inputValue)
      ) {
        return;
      }

      const onHover = isDisabled ? undefined : () => this.onOptionHover(option);
      const onSelect = isDisabled ? undefined : () => this.selectOption(option);
      const optionId = `${this.getElementId('option')}-${id}`;

      return {
        innerProps: {
          id: optionId,
          onClick: onSelect,
          onMouseMove: onHover,
          onMouseOver: onHover,
          tabIndex: -1,
        },
        data: option,
        isDisabled,
        isSelected,
        key: optionId,
        label,
        type: 'option',
        value,
      };
    };

    return options.reduce(
      (acc, item, itemIndex) => {
        if (item.options) {
          // TODO needs a tidier implementation
          if (!this.hasGroups) this.hasGroups = true;

          const { options: items } = item;
          const children = items
            .map((child, i) => {
              const option = toOption(child, `${itemIndex}-${i}`);
              if (option) acc.focusable.push(child);
              return option;
            })
            .filter(Boolean);
          if (children.length) {
            const groupId = `${this.getElementId('group')}-${itemIndex}`;
            acc.render.push({
              type: 'group',
              key: groupId,
              data: item,
              options: children,
            });
          }
        } else {
          const option = toOption(item, `${itemIndex}`);
          if (option) {
            acc.render.push(option);
            acc.focusable.push(item);
          }
        }
        return acc;
      },
      { render: [], focusable: [] }
    );
  }

  // ==============================
  // Renderers
  // ==============================
  constructAriaLiveMessage() {
    const {
      ariaLiveContext,
      selectValue,
      focusedValue,
      focusedOption,
    } = this.state;
    const { options, menuIsOpen, inputValue, screenReaderStatus } = this.props;

    // An aria live message representing the currently focused value in the select.
    const focusedValueMsg = focusedValue
      ? valueFocusAriaMessage({
          focusedValue,
          getOptionLabel: this.getOptionLabel,
          selectValue,
        })
      : '';
    // An aria live message representing the currently focused option in the select.
    const focusedOptionMsg =
      focusedOption && menuIsOpen
        ? optionFocusAriaMessage({
            focusedOption,
            getOptionLabel: this.getOptionLabel,
            options,
          })
        : '';
    // An aria live message representing the set of focusable results and current searchterm/inputvalue.
    const resultsMsg = resultsAriaMessage({
      inputValue,
      screenReaderMessage: screenReaderStatus({ count: this.countOptions() }),
    });

    return `${focusedValueMsg} ${focusedOptionMsg} ${resultsMsg} ${ariaLiveContext}`;
  }

  renderInput() {
    const {
      isDisabled,
      isSearchable,
      inputId,
      inputValue,
      tabIndex,
    } = this.props;
    const { Input } = this.components;
    const { inputIsHidden } = this.state;

    const id = inputId || this.getElementId('input');

    // aria attributes makes the JSX "noisy", separated for clarity
    const ariaAttributes = {
      'aria-autocomplete': 'list',
      'aria-label': this.props['aria-label'],
      'aria-labelledby': this.props['aria-labelledby'],
    };

    if (!isSearchable) {
      // use a dummy input to maintain focus/blur functionality
      return (
        <DummyInput
          id={id}
          innerRef={this.getInputRef}
          onBlur={this.onInputBlur}
          onChange={noop}
          onFocus={this.onInputFocus}
          readOnly
          disabled={isDisabled}
          tabIndex={tabIndex}
          value=""
          {...ariaAttributes}
        />
      );
    }

    const { cx, theme, selectProps } = this.commonProps;

    return (
      <Input
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        cx={cx}
        getStyles={this.getStyles}
        id={id}
        innerRef={this.getInputRef}
        isDisabled={isDisabled}
        isHidden={inputIsHidden}
        onBlur={this.onInputBlur}
        onChange={this.handleInputChange}
        onFocus={this.onInputFocus}
        selectProps={selectProps}
        spellCheck="false"
        tabIndex={tabIndex}
        theme={theme}
        type="text"
        value={inputValue}
        {...ariaAttributes}
      />
    );
  }
  renderPlaceholderOrValue(): ?PlaceholderOrValue {
    const {
      MultiValue,
      MultiValueContainer,
      MultiValueLabel,
      MultiValueRemove,
      SingleValue,
      Placeholder,
    } = this.components;
    const { commonProps } = this;
    const {
      controlShouldRenderValue,
      isDisabled,
      isMulti,
      inputValue,
      placeholder,
    } = this.props;
    const { selectValue, focusedValue, isFocused } = this.state;

    if (!this.hasValue() || !controlShouldRenderValue) {
      return inputValue ? null : (
        <Placeholder
          {...commonProps}
          key="placeholder"
          isDisabled={isDisabled}
          isFocused={isFocused}
        >
          {placeholder}
        </Placeholder>
      );
    }

    if (isMulti) {
      const selectValues: Array<any> = selectValue.map((opt, index) => {
        const isOptionFocused = opt === focusedValue;

        return (
          <MultiValue
            {...commonProps}
            components={{
              Container: MultiValueContainer,
              Label: MultiValueLabel,
              Remove: MultiValueRemove,
            }}
            isFocused={isOptionFocused}
            isDisabled={isDisabled}
            key={this.getOptionValue(opt)}
            index={index}
            removeProps={{
              onClick: () => this.removeValue(opt),
              onTouchEnd: () => this.removeValue(opt),
              onMouseDown: e => {
                e.preventDefault();
                e.stopPropagation();
              },
            }}
            data={opt}
          >
            {this.formatOptionLabel(opt, 'value')}
          </MultiValue>
        );
      });
      return selectValues;
    }

    if (inputValue) {
      return null;
    }

    const singleValue = selectValue[0];
    return (
      <SingleValue {...commonProps} data={singleValue} isDisabled={isDisabled}>
        {this.formatOptionLabel(singleValue, 'value')}
      </SingleValue>
    );
  }
  renderClearIndicator() {
    const { ClearIndicator } = this.components;
    const { commonProps } = this;
    const { isDisabled, isLoading } = this.props;
    const { isFocused } = this.state;

    if (
      !this.isClearable() ||
      !ClearIndicator ||
      isDisabled ||
      !this.hasValue() ||
      isLoading
    ) {
      return null;
    }

    const innerProps = {
      onMouseDown: this.onClearIndicatorMouseDown,
      onTouchEnd: this.onClearIndicatorTouchEnd,
      'aria-hidden': 'true',
    };

    return (
      <ClearIndicator
        {...commonProps}
        innerProps={innerProps}
        isFocused={isFocused}
      />
    );
  }
  renderLoadingIndicator() {
    const { LoadingIndicator } = this.components;
    const { commonProps } = this;
    const { isDisabled, isLoading } = this.props;
    const { isFocused } = this.state;

    if (!LoadingIndicator || !isLoading) return null;

    const innerProps = { 'aria-hidden': 'true' };
    return (
      <LoadingIndicator
        {...commonProps}
        innerProps={innerProps}
        isDisabled={isDisabled}
        isFocused={isFocused}
      />
    );
  }
  renderIndicatorSeparator() {
    const { DropdownIndicator, IndicatorSeparator } = this.components;

    // separator doesn't make sense without the dropdown indicator
    if (!DropdownIndicator || !IndicatorSeparator) return null;

    const { commonProps } = this;
    const { isDisabled } = this.props;
    const { isFocused } = this.state;

    return (
      <IndicatorSeparator
        {...commonProps}
        isDisabled={isDisabled}
        isFocused={isFocused}
      />
    );
  }
  renderDropdownIndicator() {
    const { DropdownIndicator } = this.components;
    if (!DropdownIndicator) return null;
    const { commonProps } = this;
    const { isDisabled } = this.props;
    const { isFocused } = this.state;

    const innerProps = {
      onMouseDown: this.onDropdownIndicatorMouseDown,
      onTouchEnd: this.onDropdownIndicatorTouchEnd,
      'aria-hidden': 'true',
    };

    return (
      <DropdownIndicator
        {...commonProps}
        innerProps={innerProps}
        isDisabled={isDisabled}
        isFocused={isFocused}
      />
    );
  }
  renderMenu() {
    const {
      Group,
      GroupHeading,
      Menu,
      MenuList,
      MenuPortal,
      LoadingMessage,
      NoOptionsMessage,
      Option,
    } = this.components;
    const { commonProps } = this;
    const { focusedOption, menuOptions } = this.state;
    const {
      captureMenuScroll,
      inputValue,
      isLoading,
      loadingMessage,
      minMenuHeight,
      maxMenuHeight,
      menuIsOpen,
      menuPlacement,
      menuPosition,
      menuPortalTarget,
      menuShouldBlockScroll,
      menuShouldScrollIntoView,
      noOptionsMessage,
      onMenuScrollToTop,
      onMenuScrollToBottom,
    } = this.props;

    if (!menuIsOpen) return null;

    // TODO: Internal Option Type here
    const render = (props: OptionType) => {
      // for performance, the menu options in state aren't changed when the
      // focused option changes so we calculate additional props based on that
      const isFocused = focusedOption === props.data;
      props.innerRef = isFocused ? this.getFocusedOptionRef : undefined;

      return (
        <Option {...commonProps} {...props} isFocused={isFocused}>
          {this.formatOptionLabel(props.data, 'menu')}
        </Option>
      );
    };

    let menuUI;

    if (this.hasOptions()) {
      menuUI = menuOptions.render.map(item => {
        if (item.type === 'group') {
          const { type, ...group } = item;
          const headingId = `${item.key}-heading`;

          return (
            <Group
              {...commonProps}
              {...group}
              Heading={GroupHeading}
              headingProps={{
                id: headingId,
              }}
              label={this.formatGroupLabel(item.data)}
            >
              {item.options.map(option => render(option))}
            </Group>
          );
        } else if (item.type === 'option') {
          return render(item);
        }
      });
    } else if (isLoading) {
      const message = loadingMessage({ inputValue });
      if (message === null) return null;
      menuUI = <LoadingMessage {...commonProps}>{message}</LoadingMessage>;
    } else {
      const message = noOptionsMessage({ inputValue });
      if (message === null) return null;
      menuUI = <NoOptionsMessage {...commonProps}>{message}</NoOptionsMessage>;
    }
    const menuPlacementProps = {
      minMenuHeight,
      maxMenuHeight,
      menuPlacement,
      menuPosition,
      menuShouldScrollIntoView,
    };

    const menuElement = (
      <MenuPlacer {...commonProps} {...menuPlacementProps}>
        {({ ref, placerProps: { placement, maxHeight } }) => (
          <Menu
            {...commonProps}
            {...menuPlacementProps}
            innerRef={ref}
            innerProps={{
              onMouseDown: this.onMenuMouseDown,
              onMouseMove: this.onMenuMouseMove,
            }}
            isLoading={isLoading}
            placement={placement}
          >
            <ScrollCaptor
              isEnabled={captureMenuScroll}
              onTopArrive={onMenuScrollToTop}
              onBottomArrive={onMenuScrollToBottom}
            >
              <ScrollBlock isEnabled={menuShouldBlockScroll}>
                <MenuList
                  {...commonProps}
                  innerRef={this.getMenuListRef}
                  isLoading={isLoading}
                  maxHeight={maxHeight}
                >
                  {menuUI}
                </MenuList>
              </ScrollBlock>
            </ScrollCaptor>
          </Menu>
        )}
      </MenuPlacer>
    );

    // positioning behaviour is almost identical for portalled and fixed,
    // so we use the same component. the actual portalling logic is forked
    // within the component based on `menuPosition`
    return menuPortalTarget || menuPosition === 'fixed' ? (
      <MenuPortal
        {...commonProps}
        appendTo={menuPortalTarget}
        controlElement={this.controlRef}
        menuPlacement={menuPlacement}
        menuPosition={menuPosition}
      >
        {menuElement}
      </MenuPortal>
    ) : (
      menuElement
    );
  }
  renderFormField() {
    const { delimiter, isDisabled, isMulti, name } = this.props;
    const { selectValue } = this.state;

    if (!name || isDisabled) return;

    if (isMulti) {
      if (delimiter) {
        const value = selectValue
          .map(opt => this.getOptionValue(opt))
          .join(delimiter);
        return <input name={name} type="hidden" value={value} />;
      } else {
        const input =
          selectValue.length > 0 ? (
            selectValue.map((opt, i) => (
              <input
                key={`i-${i}`}
                name={name}
                type="hidden"
                value={this.getOptionValue(opt)}
              />
            ))
          ) : (
            <input name={name} type="hidden" />
          );

        return <div>{input}</div>;
      }
    } else {
      const value = selectValue[0] ? this.getOptionValue(selectValue[0]) : '';
      return <input name={name} type="hidden" value={value} />;
    }
  }

  renderLiveRegion() {
    if (!this.state.isFocused) return null;
    return (
      <A11yText aria-live="polite">
        <p id="aria-selection-event">&nbsp;{this.state.ariaLiveSelection}</p>
        <p id="aria-context">&nbsp;{this.constructAriaLiveMessage()}</p>
      </A11yText>
    );
  }

  render() {
    const {
      Control,
      IndicatorsContainer,
      SelectContainer,
      ValueContainer,
    } = this.components;

    const { className, id, isDisabled, menuIsOpen } = this.props;
    const { isFocused } = this.state;
    const commonProps = (this.commonProps = this.getCommonProps());

    return (
      <SelectContainer
        {...commonProps}
        className={className}
        innerProps={{
          id: id,
          onKeyDown: this.onKeyDown,
        }}
        isDisabled={isDisabled}
        isFocused={isFocused}
      >
        {this.renderLiveRegion()}
        <Control
          {...commonProps}
          innerRef={this.getControlRef}
          innerProps={{
            onMouseDown: this.onControlMouseDown,
            onTouchEnd: this.onControlTouchEnd,
          }}
          isDisabled={isDisabled}
          isFocused={isFocused}
          menuIsOpen={menuIsOpen}
        >
          <ValueContainer {...commonProps} isDisabled={isDisabled}>
            {this.renderPlaceholderOrValue()}
            {this.renderInput()}
          </ValueContainer>
          <IndicatorsContainer {...commonProps} isDisabled={isDisabled}>
            {this.renderClearIndicator()}
            {this.renderLoadingIndicator()}
            {this.renderIndicatorSeparator()}
            {this.renderDropdownIndicator()}
          </IndicatorsContainer>
        </Control>
        {this.renderMenu()}
        {this.renderFormField()}
      </SelectContainer>
    );
  }
}

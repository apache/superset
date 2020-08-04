import * as React from 'react';

import { Option } from './filters';
import {
  InstructionsContext,
  ValueEventContext,
} from './accessibility/index';

import {
  classNames,
  noop,
  scrollIntoView,
} from './utils';

import {
  formatGroupLabel,
  getOptionLabel,
  getOptionValue,
} from './builtins';

import {
  PlaceholderOrValue,
  SelectComponents,
  SelectComponentsConfig,
} from './components/index';
import { StylesConfig } from './styles';
import { ThemeConfig } from './theme';
import {
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
  ValueType,
  GroupedOptionsType,
  OptionTypeBase,
} from './types';

export type MouseOrTouchEvent =
  | React.MouseEvent<HTMLElement>
  | React.TouchEvent<HTMLElement>;
export type FormatOptionLabelContext = 'menu' | 'value';
export interface FormatOptionLabelMeta<OptionType extends OptionTypeBase> {
  context: FormatOptionLabelContext;
  inputValue: string;
  selectValue: ValueType<OptionType>;
}

export type SelectComponentsProps = { [key in string]: any };

export interface Props<OptionType extends OptionTypeBase = { label: string; value: string }> extends SelectComponentsProps {
  /* Aria label (for assistive tech) */
  'aria-label'?: string;
  /* HTML ID of an element that should be used as the label (for assistive tech) */
  'aria-labelledby'?: string;
  /* Focus the control when it is mounted */
  autoFocus?: boolean;
  /* Remove the currently focused option when the user presses backspace */
  backspaceRemovesValue?: boolean;
  /* Remove focus from the input when the user selects an option (handy for dismissing the keyboard on touch devices) */
  blurInputOnSelect?: boolean;
  /* When the user reaches the top/bottom of the menu, prevent scroll on the scroll-parent  */
  captureMenuScroll?: boolean;
  /* className attribute applied to the outer component */
  className?: string;
  /* classNamePrefix attribute used as a base for inner component classNames */
  classNamePrefix?: string | null;
  /* Close the select menu when the user selects an option */
  closeMenuOnSelect?: boolean;
  /*
     If `true`, close the select menu when the user scrolls the document/body.

     If a function, takes a standard javascript `ScrollEvent` you return a boolean:

     `true` => The menu closes

     `false` => The menu stays open

     This is useful when you have a scrollable modal and want to portal the menu out,
     but want to avoid graphical issues.
   */
  closeMenuOnScroll?: boolean | EventListener;
  /*
    This complex object includes all the compositional components that are used
    in `react-select`. If you wish to overwrite a component, pass in an object
    with the appropriate namespace.

    If you only wish to restyle a component, we recommend using the `styles` prop
    instead. For a list of the components that can be passed in, and the shape
    that will be passed to them, see [the components docs](/api#components)
  */
  components?: SelectComponentsConfig<OptionType>;
  /* Whether the value of the select, e.g. SingleValue, should be displayed in the control. */
  controlShouldRenderValue?: boolean;
  /* Delimiter used to join multiple values into a single HTML Input value */
  delimiter?: string;
  /* Clear all values when the user presses escape AND the menu is closed */
  escapeClearsValue?: boolean;
  /* Custom method to filter whether an option should be displayed in the menu */
  filterOption?: ((
    option: Option,
    rawInput: string
  ) => boolean) | null;
  /* Formats group labels in the menu as React components */
  formatGroupLabel?: formatGroupLabel<OptionType>;
  /* Formats option labels in the menu and control as React components */
  formatOptionLabel?: (option: OptionType, labelMeta: FormatOptionLabelMeta<OptionType>) => React.ReactNode;
  /* Resolves option data to a string to be displayed as the label by components */
  getOptionLabel?: getOptionLabel<OptionType>;
  /* Resolves option data to a string to compare options and specify value attributes */
  getOptionValue?: getOptionValue<OptionType>;
  /* Hide the selected option from the menu */
  hideSelectedOptions?: boolean;
  /* The id to set on the SelectContainer component. */
  id?: string;
  /* The value of the search input */
  inputValue?: string;
  /* The id of the search input */
  inputId?: string;
  /* Define an id prefix for the select components e.g. {your-id}-value */
  instanceId?: number | string;
  /* Is the select value clearable */
  isClearable?: boolean;
  /* Is the select disabled */
  isDisabled?: boolean;
  /* Is the select in a state of loading (async) */
  isLoading?: boolean;
  /* Override the built-in logic to detect whether an option is disabled */
  isOptionDisabled?: (option: OptionType, options: OptionsType<OptionType>) => boolean | false;
  /* Override the built-in logic to detect whether an option is selected */
  isOptionSelected?: (option: OptionType, options: OptionsType<OptionType>) => boolean;
  /* Support multiple selected options */
  isMulti?: boolean;
  /* Is the select direction right-to-left */
  isRtl?: boolean;
  /* Whether to enable search functionality */
  isSearchable?: boolean;
  /* Async: Text to display when loading options */
  loadingMessage?: (obj: { inputValue: string }) => string | null;
  /* Minimum height of the menu before flipping */
  minMenuHeight?: number;
  /* Maximum height of the menu before scrolling */
  maxMenuHeight?: number;
  /* Whether the menu is open */
  menuIsOpen?: boolean;
  /* Default placement of the menu in relation to the control. 'auto' will flip
     when there isn't enough space below the control. */
  menuPlacement?: MenuPlacement;
  /* The CSS position value of the menu, when "fixed" extra layout management is required */
  menuPosition?: MenuPosition;
  /* Whether the menu should use a portal, and where it should attach */
  menuPortalTarget?: HTMLElement | null;
  /* Whether to block scroll events when the menu is open */
  menuShouldBlockScroll?: boolean;
  /* Whether the menu should be scrolled into view when it opens */
  menuShouldScrollIntoView?: boolean;
  /* Name of the HTML Input (optional - without this, no input will be rendered) */
  name?: string;
  /* Text to display when there are no options */
  noOptionsMessage?: (obj: { inputValue: string }) => string | null;
  /* Handle blur events on the control */
  onBlur?: FocusEventHandler;
  /* Handle change events on the select */
  onChange?: (value: ValueType<OptionType>, action: ActionMeta<OptionType>) => void;
  /* Handle focus events on the control */
  onFocus?: FocusEventHandler;
  /* Handle change events on the input */
  onInputChange?: (newValue: string, actionMeta: InputActionMeta) => void;
  /* Handle key down events on the select */
  onKeyDown?: KeyboardEventHandler;
  /* Handle the menu opening */
  onMenuOpen?: () => void;
  /* Handle the menu closing */
  onMenuClose?: () => void;
  /* Fired when the user scrolls to the top of the menu */
  onMenuScrollToTop?: (event: React.SyntheticEvent<HTMLElement>) => void;
  /* Fired when the user scrolls to the bottom of the menu */
  onMenuScrollToBottom?: (event: React.SyntheticEvent<HTMLElement>) => void;
  /* Allows control of whether the menu is opened when the Select is focused */
  openMenuOnFocus?: boolean;
  /* Allows control of whether the menu is opened when the Select is clicked */
  openMenuOnClick?: boolean;
  /* Array of options that populate the select menu */
  options?: GroupedOptionsType<OptionType> | OptionsType<OptionType>;
  /* Number of options to jump in menu when page{up|down} keys are used */
  pageSize?: number;
  /* Placeholder text for the select value */
  placeholder?: React.ReactNode;
  /* Status to relay to screen readers */
  screenReaderStatus?: (obj: { count: number }) => string;
  /* Style modifier methods */
  styles?: StylesConfig;
  /* Theme modifier method */
  theme?: ThemeConfig;
  /* Sets the tabIndex attribute on the input */
  tabIndex?: string | null;
  /* Select the currently focused option when the user presses tab */
  tabSelectsValue?: boolean;
  /* The value of the select; reflected by the selected option */
  value?: ValueType<OptionType>;

  defaultInputValue?: string;
  defaultMenuIsOpen?: boolean;
  defaultValue?: ValueType<OptionType>;
}

export const defaultProps: Props<any>;

export interface MenuOptions<OptionType extends OptionTypeBase> {
  render: OptionType[];
  focusable: OptionType[];
}

export interface State<OptionType extends OptionTypeBase> {
  ariaLiveSelection: string;
  ariaLiveContext: string;
  inputIsHidden: boolean;
  isFocused: boolean;
  isComposing: boolean;
  focusedOption: OptionType | null;
  focusedValue: OptionType | null;
  menuOptions: MenuOptions<OptionType>;
  selectValue: OptionsType<OptionType>;
}

export type ElRef = React.Ref<any>;

export default class Select<OptionType extends OptionTypeBase> extends React.Component<Props<OptionType>, State<OptionType>> {
  static defaultProps: Props<any>;

  // Misc. Instance Properties
  // ------------------------------

  blockOptionHover: boolean;
  clearFocusValueOnUpdate: boolean;
  commonProps: any; // TODO
  components: SelectComponents<OptionType>;
  hasGroups: boolean;
  initialTouchX: number;
  initialTouchY: number;
  inputIsHiddenAfterUpdate: boolean | null;
  instancePrefix: string;
  openAfterFocus: boolean;
  scrollToFocusedOptionOnUpdate: boolean;
  userIsDragging: boolean | null;

  // Refs
  // ------------------------------

  controlRef: ElRef;
  getControlRef: (ref: HTMLElement) => void;
  focusedOptionRef: ElRef;
  getFocusedOptionRef: (ref: HTMLElement) => void;
  menuListRef: ElRef;
  getMenuListRef: (ref: HTMLElement) => void;
  inputRef: ElRef;
  getInputRef: (ref: HTMLElement) => void;

  // Lifecycle
  // ------------------------------

  cacheComponents: (components: SelectComponents<OptionType>) => void;

  // ==============================
  // Consumer Handlers
  // ==============================

  onMenuOpen(): void;
  onMenuClose(): void;
  onInputChange(newValue: string, actionMeta: InputActionMeta): void;

  // ==============================
  // Methods
  // ==============================

  focusInput(): void;
  blurInput(): void;

  // aliased for consumers
  focus(): void;
  blur(): void;

  openMenu(focusOption: 'first' | 'last'): void;
  focusValue(direction: 'previous' | 'next'): void;

  focusOption(direction: FocusDirection): void;
  setValue: (
    newValue: ValueType<OptionType>,
    action: ActionTypes,
    option?: OptionType
  ) => void;
  selectOption: (newValue: OptionType) => void;
  removeValue: (removedValue: OptionType) => void;
  clearValue: () => void;
  popValue: () => void;

  // ==============================
  // Getters
  // ==============================

  getCommonProps(): {
    cx: any;
    clearValue: () => void;
    getStyles: (key: string, props: {}) => {};
    getValue: () => OptionType[];
    hasValue: boolean;
    isMulti: boolean;
    isRtl: boolean;
    options: OptionsType<any>;
    selectOption: (newValue: OptionType) => void;
    setValue: (newValue: ValueType<OptionType>, action: ActionTypes, option?: OptionType) => void;
    selectProps: Readonly<{
        children?: React.ReactNode;
    }> & Readonly<Props<OptionType>>;
  };

  getNextFocusedValue(nextSelectValue: OptionsType<OptionType>): OptionType;

  getNextFocusedOption(options: OptionsType<OptionType>): OptionType;
  getOptionLabel: getOptionLabel<OptionType>;
  getOptionValue: getOptionValue<OptionType>;
  getStyles: (key: string, props: {}) => {};
  getElementId: (element: 'group' | 'input' | 'listbox' | 'option') => string;
  getActiveDescendentId: () => any;

  // ==============================
  // Helpers
  // ==============================
  announceAriaLiveSelection: (props: {
    event: string,
    context: ValueEventContext,
  }) => void;
  announceAriaLiveContext: (props: {
    event: string,
    context?: InstructionsContext,
  }) => void;

  hasValue(): boolean;
  hasOptions(): boolean;
  countOptions(): number;
  isClearable(): boolean;
  isOptionDisabled(option: OptionType, selectValue: OptionsType<OptionType>): boolean;
  isOptionSelected(option: OptionType, selectValue: OptionsType<OptionType>): boolean;
  filterOption(option: {}, inputValue: string): boolean;
  formatOptionLabel(data: OptionType, context: FormatOptionLabelContext): React.ReactNode;
  formatGroupLabel: formatGroupLabel<OptionType>;

  // ==============================
  // Mouse Handlers
  // ==============================

  onMenuMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  onMenuMouseMove: (event: React.MouseEvent<HTMLElement>) => void;
  onControlMouseDown: (event: MouseOrTouchEvent) => void;
  onDropdownIndicatorMouseDown: (event: MouseOrTouchEvent) => void;
  onClearIndicatorMouseDown: (event: MouseOrTouchEvent) => void;
  onScroll: (event: Event) => void;

  // ==============================
  // Composition Handlers
  // ==============================

  startListeningComposition(): void;
  stopListeningComposition(): void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;

  // ==============================
  // Touch Handlers
  // ==============================

  startListeningToTouch(): void;
  stopListeningToTouch(): void;
  onTouchStart: (event: TouchEvent) => void;
  onTouchMove: (event: TouchEvent) => void;
  onTouchEnd: (event: TouchEvent) => void;
  onControlTouchEnd: (event: React.TouchEvent<HTMLElement>) => void;
  onClearIndicatorTouchEnd: (event: React.TouchEvent<HTMLElement>) => void;
  onDropdownIndicatorTouchEnd: (event: React.TouchEvent<HTMLElement>) => void;

  // ==============================
  // Focus Handlers
  // ==============================

  handleInputChange: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onInputFocus: (event: React.FocusEvent<HTMLInputElement>) => void;
  onInputBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  onOptionHover: (focusedOption: OptionType) => void;
  shouldHideSelectedOptions: () => boolean;

  // ==============================
  // Keyboard Handlers
  // ==============================

  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;

  // ==============================
  // Menu Options
  // ==============================

  buildMenuOptions(props: Props<OptionType>, selectValue: OptionsType<OptionType>): MenuOptions<OptionType>;

  // ==============================
  // Renderers
  // ==============================
  constructAriaLiveMessage(): string;

  renderInput(): React.ReactNode;
  renderPlaceholderOrValue(): PlaceholderOrValue<OptionType> | null;
  renderClearIndicator(): React.ReactNode;
  renderLoadingIndicator(): React.ReactNode;
  renderIndicatorSeparator(): React.ReactNode;
  renderDropdownIndicator(): React.ReactNode;
  renderMenu(): React.ReactNode;
  renderFormField(): React.ReactNode;

  renderLiveRegion(): React.ReactNode;
}

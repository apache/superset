// @flow

import { type OptionType, type OptionsType } from '../types';

export type InstructionsContext = {
  isSearchable?: boolean,
  isMulti?: boolean,
  label?: string,
  isDisabled?: boolean
};
export type ValueEventContext = { value: string, isDisabled?: boolean };

export const instructionsAriaMessage = (
  event: string,
  context?: InstructionsContext = {}
) => {
  const { isSearchable, isMulti, label, isDisabled } = context;
  switch (event) {
    case 'menu':
      return `Use Up and Down to choose options${isDisabled ? '' : ', press Enter to select the currently focused option'}, press Escape to exit the menu, press Tab to select the option and exit the menu.`;
    case 'input':
      return `${label ? label : 'Select'} is focused ${
        isSearchable ? ',type to refine list' : ''
        }, press Down to open the menu, ${
        isMulti ? ' press left to focus selected values' : ''
        }`;
    case 'value':
      return 'Use left and right to toggle between focused values, press Backspace to remove the currently focused value';
  }
};

export const valueEventAriaMessage = (
  event: string,
  context: ValueEventContext
) => {
  const { value, isDisabled } = context;
  if (!value) return;
  switch (event) {
    case 'deselect-option':
    case 'pop-value':
    case 'remove-value':
      return `option ${value}, deselected.`;
    case 'select-option':
      return isDisabled ? `option ${value} is disabled. Select another option.` : `option ${value}, selected.`;
  }
};

export const valueFocusAriaMessage = ({
  focusedValue,
  getOptionLabel,
  selectValue,
}: {
  focusedValue: OptionType,
  getOptionLabel: (option: OptionType) => string,
  selectValue: OptionsType,
}) =>
  `value ${getOptionLabel(focusedValue)} focused, ${selectValue.indexOf(
    focusedValue
  ) + 1} of ${selectValue.length}.`;

export const optionFocusAriaMessage = ({
  focusedOption,
  getOptionLabel,
  options,
}: {
  focusedOption: OptionType,
  getOptionLabel: (option: OptionType) => string,
  options: OptionsType,
}) =>
  `option ${getOptionLabel(focusedOption)} focused${focusedOption.isDisabled ? ' disabled' : ''}, ${options.indexOf(
    focusedOption
  ) + 1} of ${options.length}.`;

export const resultsAriaMessage = ({
  inputValue,
  screenReaderMessage,
}: {
  inputValue: string,
  screenReaderMessage: string,
}) =>
  `${screenReaderMessage}${
  inputValue ? ' for search term ' + inputValue : ''
  }.`;

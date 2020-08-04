import React from 'react';
import { shallow, mount } from 'enzyme';
import toJson from 'enzyme-to-json';
import cases from 'jest-in-case';

import {
  OPTIONS,
  OPTIONS_NUMBER_VALUE,
  OPTIONS_BOOLEAN_VALUE,
  OPTIONS_DISABLED
} from './constants';
import Select from '../Select';
import { components } from '../components';

const {
  ClearIndicator,
  Control,
  DropdownIndicator,
  GroupHeading,
  IndicatorsContainer,
  Input,
  Menu,
  MultiValue,
  NoOptionsMessage,
  Option,
  Placeholder,
  ValueContainer,
  SingleValue,
} = components;

const BASIC_PROPS = {
  className: 'react-select',
  classNamePrefix: 'react-select',
  onChange: jest.fn(),
  onInputChange: jest.fn(),
  onMenuClose: jest.fn(),
  onMenuOpen: jest.fn(),
  name: 'test-input-name',
  options: OPTIONS,
};

test('snapshot - defaults', () => {
  const tree = shallow(<Select />);
  expect(toJson(tree)).toMatchSnapshot();
});

test('instanceId prop > to have instanceId as id prefix for the select components', () => {
  let selectWrapper = mount(
    <Select {...BASIC_PROPS} menuIsOpen instanceId={'custom-id'} />
  );
  expect(selectWrapper.find(Input).props().id).toContain('custom-id');
  selectWrapper.find('div.react-select__option').forEach(opt => {
    expect(opt.props().id).toContain('custom-id');
  });
});

test('hidden input field is not present if name is not passes', () => {
  let selectWrapper = mount(<Select options={OPTIONS} />);
  expect(selectWrapper.find('input[type="hidden"]').exists()).toBeFalsy();
});

test('hidden input field is present if name passes', () => {
  let selectWrapper = mount(
    <Select name="test-input-name" options={OPTIONS} />
  );
  expect(selectWrapper.find('input[type="hidden"]').exists()).toBeTruthy();
});

test('single select > passing multiple values > should select the first value', () => {
  const props = { ...BASIC_PROPS, value: [OPTIONS[0], OPTIONS[4]] };
  let selectWrapper = mount(<Select {...props} />);
  expect(selectWrapper.find(Control).text()).toBe('0');
});

test('isRtl boolean props is passed down to the control component', () => {
  let selectWrapper = mount(
    <Select {...BASIC_PROPS} value={[OPTIONS[0]]} isRtl isClearable />
  );
  expect(selectWrapper.props().isRtl).toBe(true);
});

test('isOptionSelected() prop > single select > mark value as isSelected if isOptionSelected returns true for the option', () => {
  // Select all but option with label '1'
  let isOptionSelected = jest.fn(option => option.label !== '1');
  let selectWrapper = mount(
    <Select {...BASIC_PROPS} isOptionSelected={isOptionSelected} menuIsOpen />
  );
  // Option label 0 to be selected
  expect(
    selectWrapper
      .find(Option)
      .at(0)
      .props().isSelected
  ).toBe(true);
  // Option label 1 to be not selected
  expect(
    selectWrapper
      .find(Option)
      .at(1)
      .props().isSelected
  ).toBe(false);
});

test('isOptionSelected() prop > multi select > to not show the selected options in Menu for multiSelect', () => {
  // Select all but option with label '1'
  let isOptionSelected = jest.fn(option => option.label !== '1');
  let selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      isMulti
      isOptionSelected={isOptionSelected}
      menuIsOpen
    />
  );

  expect(selectWrapper.find(Option).length).toBe(1);
  expect(selectWrapper.find(Option).text()).toBe('1');
});

cases(
  'formatOptionLabel',
  ({ props, valueComponent, expectedOptions }) => {
    let selectWrapper = shallow(<Select {...props} />);
    let value = selectWrapper.find(valueComponent).at(0);
    expect(value.props().children).toBe(expectedOptions);
  },
  {
    'single select > should format label of options according to text returned by formatOptionLabel': {
      props: {
        ...BASIC_PROPS,
        formatOptionLabel: ({ label, value }, { context }) =>
          `${label} ${value} ${context}`,
        value: OPTIONS[0],
      },
      valueComponent: SingleValue,
      expectedOptions: '0 zero value',
    },
    'multi select > should format label of options according to text returned by formatOptionLabel': {
      props: {
        ...BASIC_PROPS,
        formatOptionLabel: ({ label, value }, { context }) =>
          `${label} ${value} ${context}`,
        isMulti: true,
        value: OPTIONS[0],
      },
      valueComponent: MultiValue,
      expectedOptions: '0 zero value',
    },
  }
);

cases(
  'name prop',
  ({ expectedName, props }) => {
    let selectWrapper = shallow(<Select {...props} />);
    let input = selectWrapper.find('input');
    expect(input.props().name).toBe(expectedName);
  },
  {
    'single select > should assign the given name': {
      props: { ...BASIC_PROPS, name: 'form-field-single-select' },
      expectedName: 'form-field-single-select',
    },
    'multi select > should assign the given name': {
      props: {
        ...BASIC_PROPS,
        name: 'form-field-multi-select',
        isMulti: true,
        value: OPTIONS[2],
      },
      expectedName: 'form-field-multi-select',
    },
  }
);

cases(
  'menuIsOpen prop',
  ({ props = BASIC_PROPS }) => {
    let selectWrapper = mount(<Select {...props} />);
    expect(selectWrapper.find(Menu).exists()).toBeFalsy();

    selectWrapper.setProps({ menuIsOpen: true });
    expect(selectWrapper.find(Menu).exists()).toBeTruthy();

    selectWrapper.setProps({ menuIsOpen: false });
    expect(selectWrapper.find(Menu).exists()).toBeFalsy();
  },
  {
    'single select > should show menu if menuIsOpen is true and hide menu if menuIsOpen prop is false': {},
    'multi select > should show menu if menuIsOpen is true and hide menu if menuIsOpen prop is false': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
    },
  }
);

cases(
  'filterOption() prop - should filter only if function returns truthy for value',
  ({ props, searchString, expectResultsLength }) => {
    let selectWrapper = mount(<Select {...props} />);
    selectWrapper.setProps({ inputValue: searchString });
    expect(selectWrapper.find(Option).length).toBe(expectResultsLength);
  },
  {
    'single select > should filter all options as per searchString': {
      props: {
        ...BASIC_PROPS,
        filterOption: (value, search) => value.value.indexOf(search) > -1,
        menuIsOpen: true,
        value: OPTIONS[0],
      },
      searchString: 'o',
      expectResultsLength: 5,
    },
    'multi select > should filter all options other that options in value of select': {
      props: {
        ...BASIC_PROPS,
        filterOption: (value, search) => value.value.indexOf(search) > -1,
        isMulti: true,
        menuIsOpen: true,
        value: OPTIONS[0],
      },
      searchString: 'o',
      expectResultsLength: 4,
    },
  }
);

cases(
  'filterOption prop is null',
  ({ props, searchString, expectResultsLength }) => {
    let selectWrapper = mount(<Select {...props} />);
    selectWrapper.setProps({ inputValue: searchString });
    expect(selectWrapper.find(Option).length).toBe(expectResultsLength);
  },
  {
    'single select > should show all the options': {
      props: {
        ...BASIC_PROPS,
        filterOption: null,
        menuIsOpen: true,
        value: OPTIONS[0],
      },
      searchString: 'o',
      expectResultsLength: 17,
    },
    'multi select > should show all the options other than selected options': {
      props: {
        ...BASIC_PROPS,
        filterOption: null,
        isMulti: true,
        menuIsOpen: true,
        value: OPTIONS[0],
      },
      searchString: 'o',
      expectResultsLength: 16,
    },
  }
);

cases(
  'no option found on search based on filterOption prop',
  ({ props, searchString }) => {
    let selectWrapper = mount(<Select {...props} />);
    selectWrapper.setProps({ inputValue: searchString });
    expect(selectWrapper.find(NoOptionsMessage).exists()).toBeTruthy();
  },
  {
    'single Select > should show NoOptionsMessage': {
      props: {
        ...BASIC_PROPS,
        filterOption: (value, search) => value.value.indexOf(search) > -1,
        menuIsOpen: true,
      },
      searchString: 'some text not in options',
    },
    'multi select > should show NoOptionsMessage': {
      props: {
        ...BASIC_PROPS,
        filterOption: (value, search) => value.value.indexOf(search) > -1,
        menuIsOpen: true,
      },
      searchString: 'some text not in options',
    },
  }
);

cases(
  'noOptionsMessage() function prop',
  ({ props, expectNoOptionsMessage, searchString }) => {
    let selectWrapper = mount(<Select {...props} />);
    selectWrapper.setProps({ inputValue: searchString });
    expect(selectWrapper.find(NoOptionsMessage).props().children).toBe(
      expectNoOptionsMessage
    );
  },
  {
    'single Select > should show NoOptionsMessage returned from noOptionsMessage function prop': {
      props: {
        ...BASIC_PROPS,
        filterOption: (value, search) => value.value.indexOf(search) > -1,
        menuIsOpen: true,
        noOptionsMessage: () =>
          'this is custom no option message for single select',
      },
      expectNoOptionsMessage:
        'this is custom no option message for single select',
      searchString: 'some text not in options',
    },
    'multi select > should show NoOptionsMessage returned from noOptionsMessage function prop': {
      props: {
        ...BASIC_PROPS,
        filterOption: (value, search) => value.value.indexOf(search) > -1,
        menuIsOpen: true,
        noOptionsMessage: () =>
          'this is custom no option message for multi select',
      },
      expectNoOptionsMessage:
        'this is custom no option message for multi select',
      searchString: 'some text not in options',
    },
  }
);

cases(
  'value prop',
  ({ props, expectedValue }) => {
    let selectWrapper = shallow(<Select {...props} />);
    expect(selectWrapper.state('selectValue')).toEqual(expectedValue);
  },
  {
    'single select > should set it as initial value': {
      props: {
        ...BASIC_PROPS,
        value: OPTIONS[2],
      },
      expectedValue: [{ label: '2', value: 'two' }],
    },
    'single select > with option values as number > should set it as initial value': {
      props: {
        ...BASIC_PROPS,
        value: OPTIONS_NUMBER_VALUE[2],
      },
      expectedValue: [{ label: '2', value: 2 }],
    },
    'multi select > should set it as initial value': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        value: OPTIONS[1],
      },
      expectedValue: [{ label: '1', value: 'one' }],
    },
    'multi select > with option values as number > should set it as initial value': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        value: OPTIONS_NUMBER_VALUE[1],
      },
      expectedValue: [{ label: '1', value: 1 }],
    },
  }
);

cases(
  'update the value prop',
  ({
    props = { ...BASIC_PROPS, value: OPTIONS[1] },
    updateValueTo,
    expectedInitialValue,
    expectedUpdatedValue,
  }) => {
    let selectWrapper = mount(<Select {...props} />);
    expect(selectWrapper.find('input[type="hidden"]').props().value).toEqual(
      expectedInitialValue
    );

    selectWrapper.setProps({ value: updateValueTo });
    expect(selectWrapper.find('input[type="hidden"]').props().value).toEqual(
      expectedUpdatedValue
    );
  },
  {
    'single select > should update the value when prop is updated': {
      updateValueTo: OPTIONS[3],
      expectedInitialValue: 'one',
      expectedUpdatedValue: 'three',
    },
    'single select > value of options is number > should update the value when prop is updated': {
      props: {
        ...BASIC_PROPS,
        options: OPTIONS_NUMBER_VALUE,
        value: OPTIONS_NUMBER_VALUE[2],
      },
      updateValueTo: OPTIONS_NUMBER_VALUE[3],
      expectedInitialValue: 2,
      expectedUpdatedValue: 3,
    },
    'multi select > should update the value when prop is updated': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        value: OPTIONS[1],
      },
      updateValueTo: OPTIONS[3],
      expectedInitialValue: 'one',
      expectedUpdatedValue: 'three',
    },
    'multi select > value of options is number > should update the value when prop is updated': {
      props: {
        ...BASIC_PROPS,
        delimiter: ',',
        isMulti: true,
        options: OPTIONS_NUMBER_VALUE,
        value: OPTIONS_NUMBER_VALUE[2],
      },
      updateValueTo: [OPTIONS_NUMBER_VALUE[3], OPTIONS_NUMBER_VALUE[2]],
      expectedInitialValue: '2',
      expectedUpdatedValue: '3,2',
    },
  }
);

cases(
  'calls onChange on selecting an option',
  ({
    props = { ...BASIC_PROPS, menuIsOpen: true },
    event,
    expectedSelectedOption,
    optionsSelected,
    focusedOption,
    expectedActionMetaOption,
  }) => {
    let onChangeSpy = jest.fn();
    props = { ...props, onChange: onChangeSpy };
    let selectWrapper = mount(<Select {...props} />);

    let selectOption = selectWrapper
      .find('div.react-select__option')
      .findWhere(n => n.props().children === optionsSelected.label);
    selectWrapper.setState({ focusedOption });

    selectOption.simulate(...event);
    selectWrapper.update();
    expect(onChangeSpy).toHaveBeenCalledWith(expectedSelectedOption, {
      action: 'select-option',
      option: expectedActionMetaOption,
      name: BASIC_PROPS.name
    });
  },
  {
    'single select > option is clicked > should call onChange() prop with selected option': {
      event: ['click'],
      optionsSelected: { label: '2', value: 'two' },
      expectedSelectedOption: { label: '2', value: 'two' },
    },
    'single select > option with number value > option is clicked > should call onChange() prop with selected option': {
      props: {
        ...BASIC_PROPS,
        menuIsOpen: true,
        options: OPTIONS_NUMBER_VALUE,
      },
      event: ['click'],
      optionsSelected: { label: '0', value: 0 },
      expectedSelectedOption: { label: '0', value: 0 },
    },
    'single select > option with boolean value > option is clicked > should call onChange() prop with selected option': {
      props: {
        ...BASIC_PROPS,
        menuIsOpen: true,
        options: OPTIONS_BOOLEAN_VALUE,
      },
      event: ['click'],
      optionsSelected: { label: 'true', value: true },
      expectedSelectedOption: { label: 'true', value: true },
    },
    'single select > tab key is pressed while focusing option > should call onChange() prop with selected option': {
      event: ['keyDown', { keyCode: 9, key: 'Tab' }],
      optionsSelected: { label: '1', value: 'one' },
      focusedOption: { label: '1', value: 'one' },
      expectedSelectedOption: { label: '1', value: 'one' },
    },
    'single select > enter key is pressed while focusing option > should call onChange() prop with selected option': {
      event: ['keyDown', { keyCode: 13, key: 'Enter' }],
      optionsSelected: { label: '3', value: 'three' },
      focusedOption: { label: '3', value: 'three' },
      expectedSelectedOption: { label: '3', value: 'three' },
    },
    'single select > space key is pressed while focusing option > should call onChange() prop with selected option': {
      event: ['keyDown', { keyCode: 32, key: ' ' }],
      optionsSelected: { label: '1', value: 'one' },
      focusedOption: { label: '1', value: 'one' },
      expectedSelectedOption: { label: '1', value: 'one' },
    },
    'multi select > option is clicked > should call onChange() prop with selected option': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      event: ['click'],
      optionsSelected: { label: '2', value: 'two' },
      expectedSelectedOption: [{ label: '2', value: 'two' }],
      expectedActionMetaOption: { label: '2', value: 'two' },
    },
    'multi select > option with number value > option is clicked > should call onChange() prop with selected option': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS_NUMBER_VALUE,
      },
      event: ['click'],
      optionsSelected: { label: '0', value: 0 },
      expectedSelectedOption: [{ label: '0', value: 0 }],
      expectedActionMetaOption: { label: '0', value: 0 },
    },
    'multi select > option with boolean value > option is clicked > should call onChange() prop with selected option': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS_BOOLEAN_VALUE,
      },
      event: ['click'],
      optionsSelected: { label: 'true', value: true },
      expectedSelectedOption: [{ label: 'true', value: true }],
      expectedActionMetaOption: { label: 'true', value: true },
    },
    'multi select > tab key is pressed while focusing option > should call onChange() prop with selected option': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      event: ['keyDown', { keyCode: 9, key: 'Tab' }],
      menuIsOpen: true,
      optionsSelected: { label: '1', value: 'one' },
      focusedOption: { label: '1', value: 'one' },
      expectedSelectedOption: [{ label: '1', value: 'one' }],
      expectedActionMetaOption: { label: '1', value: 'one' },
    },
    'multi select > enter key is pressed while focusing option > should call onChange() prop with selected option': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      event: ['keyDown', { keyCode: 13, key: 'Enter' }],
      optionsSelected: { label: '3', value: 'three' },
      focusedOption: { label: '3', value: 'three' },
      expectedSelectedOption: [{ label: '3', value: 'three' }],
      expectedActionMetaOption: { label: '3', value: 'three' },
    },
    'multi select > space key is pressed while focusing option > should call onChange() prop with selected option': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      event: ['keyDown', { keyCode: 32, key: ' ' }],
      optionsSelected: { label: '1', value: 'one' },
      focusedOption: { label: '1', value: 'one' },
      expectedSelectedOption: [{ label: '1', value: 'one' }],
      expectedActionMetaOption: { label: '1', value: 'one' },
    },
  }
);

cases(
  'calls onChange on de-selecting an option in multi select',
  ({
    props = { ...BASIC_PROPS },
    event,
    expectedSelectedOption,
    expectedMetaOption,
    optionsSelected,
    focusedOption,
  }) => {
    let onChangeSpy = jest.fn();
    props = { ...props, onChange: onChangeSpy, menuIsOpen: true, hideSelectedOptions: false, isMulti: true, menuIsOpen: true };
    let selectWrapper = mount(<Select {...props} />);

    let selectOption = selectWrapper
      .find('div.react-select__option')
      .findWhere(n => n.props().children === optionsSelected.label);
    selectWrapper.setState({ focusedOption });

    selectOption.simulate(...event);
    selectWrapper.update();
    expect(onChangeSpy).toHaveBeenCalledWith(expectedSelectedOption, {
      action: 'deselect-option',
      option: expectedMetaOption,
      name: BASIC_PROPS.name
    });
  },
  {
    'option is clicked > should call onChange() prop with correct selected options and meta': {
      props: {
        ...BASIC_PROPS,
        options: OPTIONS,
        value: [{ label: '2', value: 'two' }]
      },
      event: ['click'],
      optionsSelected: { label: '2', value: 'two' },
      expectedSelectedOption: [],
      expectedMetaOption: { label: '2', value: 'two' }
    },
    'option with number value > option is clicked > should call onChange() prop with selected option': {
      props: {
        ...BASIC_PROPS,
        options: OPTIONS_NUMBER_VALUE,
        value: [{ label: '0', value: 0 }]
      },
      event: ['click'],
      optionsSelected: { label: '0', value: 0 },
      expectedSelectedOption: [],
      expectedMetaOption: { label: '0', value: 0 }
    },
    'option with boolean value > option is clicked > should call onChange() prop with selected option': {
      props: {
        ...BASIC_PROPS,
        options: OPTIONS_BOOLEAN_VALUE,
        value: [{ label: 'true', value: true }]
      },
      event: ['click'],
      optionsSelected: { label: 'true', value: true },
      expectedSelectedOption: [],
      expectedMetaOption: { label: 'true', value: true }
    },
    'tab key is pressed while focusing option > should call onChange() prop with selected option': {
      props: {
        ...BASIC_PROPS,
        options: OPTIONS,
        value: [{ label: '1', value: 'one' }]
      },
      event: ['keyDown', { keyCode: 9, key: 'Tab' }],
      menuIsOpen: true,
      optionsSelected: { label: '1', value: 'one' },
      focusedOption: { label: '1', value: 'one' },
      expectedSelectedOption: [],
      expectedMetaOption: { label: '1', value: 'one' },
    },
    'enter key is pressed while focusing option > should call onChange() prop with selected option': {
      props: {
        ...BASIC_PROPS,
        options: OPTIONS,
        value: { label: '3', value: 'three' }
      },
      event: ['keyDown', { keyCode: 13, key: 'Enter' }],
      optionsSelected: { label: '3', value: 'three' },
      focusedOption: { label: '3', value: 'three' },
      expectedSelectedOption: [],
      expectedMetaOption: { label: '3', value: 'three' },
    },
    'space key is pressed while focusing option > should call onChange() prop with selected option': {
      props: {
        ...BASIC_PROPS,
        options: OPTIONS,
        value: [{ label: '1', value: 'one' }]
      },
      event: ['keyDown', { keyCode: 32, key: ' ' }],
      optionsSelected: { label: '1', value: 'one' },
      focusedOption: { label: '1', value: 'one' },
      expectedSelectedOption: [],
      expectedMetaOption: { label: '1', value: 'one' },
    },
  }
);

cases(
  'hitting escape on select option',
  ({ props, event, focusedOption, optionsSelected }) => {
    let onChangeSpy = jest.fn();
    let selectWrapper = mount(
      <Select
        {...props}
        onChange={onChangeSpy}
        onInputChange={jest.fn()}
        onMenuClose={jest.fn()}
      />
    );

    let selectOption = selectWrapper
      .find('div.react-select__option')
      .findWhere(n => n.props().children === optionsSelected.label);
    selectWrapper.setState({ focusedOption });

    selectOption.simulate(...event);
    expect(onChangeSpy).not.toHaveBeenCalled();
  },
  {
    'single select > should not call onChange prop': {
      props: {
        ...BASIC_PROPS,
        menuIsOpen: true,
      },
      optionsSelected: { label: '1', value: 'one' },
      focusedOption: { label: '1', value: 'one' },
      event: ['keyDown', { keyCode: 27 }],
    },
    'multi select > should not call onChange prop': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        menuIsOpen: true,
      },
      optionsSelected: { label: '1', value: 'one' },
      focusedOption: { label: '1', value: 'one' },
      event: ['keyDown', { keyCode: 27 }],
    },
  }
);

cases(
  'click to open select',
  ({ props = BASIC_PROPS, expectedToFocus }) => {
    let selectWrapper = mount(<Select {...props} onMenuOpen={() => { }} />);

    // this will get updated on input click, though click on input is not bubbling up to control component
    selectWrapper.setState({ isFocused: true });
    selectWrapper.setProps({ menuIsOpen: true });
    let controlComponent = selectWrapper.find('div.react-select__control');
    controlComponent.simulate('mouseDown', { target: { tagName: 'div' } });
    expect(selectWrapper.state('focusedOption')).toEqual(expectedToFocus);
  },
  {
    'single select > should focus the first option': {
      expectedToFocus: { label: '0', value: 'zero' },
    },
    'multi select > should focus the first option': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
      expectedToFocus: { label: '0', value: 'zero' },
    },
  }
);

test('clicking when focused does not open select when openMenuOnClick=false', () => {
  let spy = jest.fn();
  let selectWrapper = mount(<Select {...BASIC_PROPS} openMenuOnClick={false} onMenuOpen={spy} />);

  // this will get updated on input click, though click on input is not bubbling up to control component
  selectWrapper.setState({ isFocused: true });
  let controlComponent = selectWrapper.find('div.react-select__control');
  controlComponent.simulate('mouseDown', { target: { tagName: 'div' } });
  expect(spy).not.toHaveBeenCalled();
});

cases(
  'focus on options > keyboard interaction with Menu',
  ({ props, selectedOption, nextFocusOption, keyEvent = [] }) => {
    let selectWrapper = mount(<Select {...props} />);

    selectWrapper.setState({ focusedOption: selectedOption });
    expect(selectWrapper.state('focusedOption')).toEqual(selectedOption);

    keyEvent.map(event => selectWrapper.find(Menu).simulate('keyDown', event));
    expect(selectWrapper.state('focusedOption')).toEqual(nextFocusOption);
  },
  {
    'single select > ArrowDown key on first option should focus second option': {
      props: {
        ...BASIC_PROPS,
        menuIsOpen: true,
      },
      keyEvent: [{ keyCode: 40, key: 'ArrowDown' }],
      selectedOption: OPTIONS[0],
      nextFocusOption: OPTIONS[1],
    },
    'single select > ArrowDown key on last option should focus first option': {
      props: {
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 40, key: 'ArrowDown' }],
      selectedOption: OPTIONS[OPTIONS.length - 1],
      nextFocusOption: OPTIONS[0],
    },
    'single select > ArrowUp key on first option should focus last option': {
      props: {
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 38, key: 'ArrowUp' }],
      selectedOption: OPTIONS[0],
      nextFocusOption: OPTIONS[OPTIONS.length - 1],
    },
    'single select > ArrowUp key on last option should focus second last option': {
      props: {
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 38, key: 'ArrowUp' }],
      selectedOption: OPTIONS[OPTIONS.length - 1],
      nextFocusOption: OPTIONS[OPTIONS.length - 2],
    },
    'single select > disabled options should be focusable': {
      props: {
        menuIsOpen: true,
        options: OPTIONS_DISABLED,
      },
      keyEvent: [{ keyCode: 40, key: 'ArrowDown' }],
      selectedOption: OPTIONS_DISABLED[0],
      nextFocusOption: OPTIONS_DISABLED[1],
    },
    'single select > PageDown key takes us to next page with default page size of 5': {
      props: {
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 34, key: 'PageDown' }],
      selectedOption: OPTIONS[0],
      nextFocusOption: OPTIONS[5],
    },
    'single select > PageDown key takes us to next page with custom pageSize 7': {
      props: {
        menuIsOpen: true,
        pageSize: 7,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 34, key: 'PageDown' }],
      selectedOption: OPTIONS[0],
      nextFocusOption: OPTIONS[7],
    },
    'single select > PageDown key takes to the last option is options below is less then page size': {
      props: {
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 34, key: 'PageDown' }],
      selectedOption: OPTIONS[OPTIONS.length - 3],
      nextFocusOption: OPTIONS[OPTIONS.length - 1],
    },
    'single select > PageUp key takes us to previous page with default page size of 5': {
      props: {
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 33, key: 'PageUp' }],
      selectedOption: OPTIONS[6],
      nextFocusOption: OPTIONS[1],
    },
    'single select > PageUp key takes us to previous page with custom pageSize of 7': {
      props: {
        menuIsOpen: true,
        pageSize: 7,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 33, key: 'PageUp' }],
      selectedOption: OPTIONS[9],
      nextFocusOption: OPTIONS[2],
    },
    'single select > PageUp key takes us to first option - (previous options < pageSize)': {
      props: {
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 33, key: 'PageUp' }],
      selectedOption: OPTIONS[1],
      nextFocusOption: OPTIONS[0],
    },
    'single select > Home key takes up to the first option': {
      props: {
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 36, key: 'Home' }],
      selectedOption: OPTIONS[OPTIONS.length - 3],
      nextFocusOption: OPTIONS[0],
    },
    'single select > End key takes down to the last option': {
      props: {
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 35, key: 'End' }],
      selectedOption: OPTIONS[2],
      nextFocusOption: OPTIONS[OPTIONS.length - 1],
    },
    'multi select > ArrowDown key on first option should focus second option': {
      props: {
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 40, key: 'ArrowDown' }],
      selectedOption: OPTIONS[0],
      nextFocusOption: OPTIONS[1],
    },
    'multi select > ArrowDown key on last option should focus first option': {
      props: {
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 40, key: 'ArrowDown' }],
      selectedOption: OPTIONS[OPTIONS.length - 1],
      nextFocusOption: OPTIONS[0],
    },
    'multi select > ArrowUp key on first option should focus last option': {
      props: {
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 38, key: 'ArrowUp' }],
      selectedOption: OPTIONS[0],
      nextFocusOption: OPTIONS[OPTIONS.length - 1],
    },
    'multi select > ArrowUp key on last option should focus second last option': {
      props: {
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 38, key: 'ArrowUp' }],
      selectedOption: OPTIONS[OPTIONS.length - 1],
      nextFocusOption: OPTIONS[OPTIONS.length - 2],
    },
    'multi select > PageDown key takes us to next page with default page size of 5': {
      props: {
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 34, key: 'PageDown' }],
      selectedOption: OPTIONS[0],
      nextFocusOption: OPTIONS[5],
    },
    'multi select > PageDown key takes us to next page with custom pageSize of 8': {
      props: {
        isMulti: true,
        menuIsOpen: true,
        pageSize: 8,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 34, key: 'PageDown' }],
      selectedOption: OPTIONS[0],
      nextFocusOption: OPTIONS[8],
    },
    'multi select > PageDown key takes to the last option is options below is less then page size': {
      props: {
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 34, key: 'PageDown' }],
      selectedOption: OPTIONS[OPTIONS.length - 3],
      nextFocusOption: OPTIONS[OPTIONS.length - 1],
    },
    'multi select > PageUp key takes us to previous page with default page size of 5': {
      props: {
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 33, key: 'PageUp' }],
      selectedOption: OPTIONS[6],
      nextFocusOption: OPTIONS[1],
    },
    'multi select > PageUp key takes us to previous page with default page size of 9': {
      props: {
        isMulti: true,
        menuIsOpen: true,
        pageSize: 9,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 33, key: 'PageUp' }],
      selectedOption: OPTIONS[10],
      nextFocusOption: OPTIONS[1],
    },
    'multi select > PageUp key takes us to first option - previous options < pageSize': {
      props: {
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 33, key: 'PageUp' }],
      selectedOption: OPTIONS[1],
      nextFocusOption: OPTIONS[0],
    },
    'multi select > Home key takes up to the first option': {
      props: {
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 36, key: 'Home' }],
      selectedOption: OPTIONS[OPTIONS.length - 3],
      nextFocusOption: OPTIONS[0],
    },
    'multi select > End key takes down to the last option': {
      props: {
        isMulti: true,
        menuIsOpen: true,
        options: OPTIONS,
      },
      keyEvent: [{ keyCode: 35, key: 'End' }],
      selectedOption: OPTIONS[2],
      nextFocusOption: OPTIONS[OPTIONS.length - 1],
    },
  }
);

// TODO: Cover more scenario
cases(
  'hitting escape with inputValue in select',
  ({ props }) => {
    let spy = jest.fn();
    let selectWrapper = mount(
      <Select {...props} onInputChange={spy} onMenuClose={jest.fn()} />
    );

    selectWrapper.simulate('keyDown', { keyCode: 27, key: 'Escape' });
    expect(spy).toHaveBeenCalledWith('', { action: 'menu-close' });
  },
  {
    'single select > should call onInputChange prop with empty string as inputValue': {
      props: {
        ...BASIC_PROPS,
        inputValue: 'test',
        menuIsOpen: true,
        value: OPTIONS[0],
      },
    },
    'multi select > should call onInputChange prop with empty string as inputValue': {
      props: {
        ...BASIC_PROPS,
        inputValue: 'test',
        isMulti: true,
        menuIsOpen: true,
        value: OPTIONS[0],
      },
    },
  }
);

cases(
  'Clicking dropdown indicator on select with closed menu with primary button on mouse',
  ({ props = BASIC_PROPS }) => {
    let onMenuOpenSpy = jest.fn();
    props = { ...props, onMenuOpen: onMenuOpenSpy };
    let selectWrapper = mount(<Select {...props} />);
    // Menu is closed
    expect(selectWrapper.find(Menu).exists()).toBeFalsy();
    selectWrapper
      .find('div.react-select__dropdown-indicator')
      .simulate('mouseDown', { button: 0 });
    expect(onMenuOpenSpy).toHaveBeenCalled();
  },
  {
    'single select > should call onMenuOpen prop when select is opened and onMenuClose prop when select is closed': {},
    'multi select > should call onMenuOpen prop when select is opened and onMenuClose prop when select is closed': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
    },
  }
);

cases(
  'Clicking dropdown indicator on select with open menu with primary button on mouse',
  ({ props = BASIC_PROPS }) => {
    let onMenuCloseSpy = jest.fn();
    props = { ...props, onMenuClose: onMenuCloseSpy };
    let selectWrapper = mount(<Select {...props} menuIsOpen />);
    // Menu is open
    expect(selectWrapper.find(Menu).exists()).toBeTruthy();
    selectWrapper
      .find('div.react-select__dropdown-indicator')
      .simulate('mouseDown', { button: 0 });
    expect(onMenuCloseSpy).toHaveBeenCalled();
  },
  {
    'single select > should call onMenuOpen prop when select is opened and onMenuClose prop when select is closed': {},
    'multi select > should call onMenuOpen prop when select is opened and onMenuClose prop when select is closed': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
    },
  }
);

cases('Clicking Enter on a focused select', ({ props = BASIC_PROPS, expectedValue }) => {
  let wrapper = mount(<Select { ...props } autoFocus/>);
  let event = {
    key: 'Enter',
    defaultPrevented: false,
    preventDefault: function () {
      this.defaultPrevented = true;
    }
  };
  const selectWrapper = wrapper.find(Select);
  selectWrapper.instance().setState({ focusedOption: OPTIONS[0] });
  selectWrapper.instance().onKeyDown(event);
  console.log(event.defaultPrevented);
  expect(event.defaultPrevented).toBe(expectedValue);
}, {
  'while menuIsOpen && focusedOption && !isComposing  > should invoke event.preventDefault': {
    props: {
      ...BASIC_PROPS,
      menuIsOpen: true,
    },
    expectedValue: true,
  },
  'while !menuIsOpen > should not invoke event.preventDefault': {
    props: {
      ...BASIC_PROPS,
    },
    expectedValue: false,
  }
});

cases(
  'clicking on select using secondary button on mouse',
  ({ props = BASIC_PROPS }) => {
    let onMenuOpenSpy = jest.fn();
    let onMenuCloseSpy = jest.fn();
    let selectWrapper = mount(
      <Select
        {...props}
        onMenuClose={onMenuCloseSpy}
        onMenuOpen={onMenuOpenSpy}
      />
    );
    let downButtonWrapper = selectWrapper.find(
      'div.react-select__dropdown-indicator'
    );

    // does not open menu if menu is closed
    expect(selectWrapper.props().menuIsOpen).toBe(false);
    downButtonWrapper.simulate('mouseDown', { button: 1 });
    expect(onMenuOpenSpy).not.toHaveBeenCalled();

    // does not close menu if menu is opened
    selectWrapper.setProps({ menuIsOpen: true });
    downButtonWrapper.simulate('mouseDown', { button: 1 });
    expect(onMenuCloseSpy).not.toHaveBeenCalled();
  },
  {
    'single select > secondary click is ignored > should not call onMenuOpen and onMenuClose prop': {},
    'multi select > secondary click is ignored > should not call onMenuOpen and onMenuClose prop': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
    },
  }
);

cases(
  'required on input is not there by default',
  ({ props = BASIC_PROPS }) => {
    let selectWrapper = mount(<Select {...props} onInputChange={jest.fn()} />);
    let inputWrapper = selectWrapper.find('Control input');
    expect(inputWrapper.props().required).toBeUndefined();
  },
  {
    'single select > should not have required attribute': {},
    'multi select > should not have required attribute': {},
  }
);

cases(
  'value of hidden input control',
  ({ props = { options: OPTIONS }, expectedValue }) => {
    let selectWrapper = mount(<Select {...props} />);
    let hiddenInput = selectWrapper.find('input[type="hidden"]');
    expect(hiddenInput.props().value).toEqual(expectedValue);
  },
  {
    'single select > should set value of input as value prop': {
      props: {
        ...BASIC_PROPS,
        value: OPTIONS[3],
      },
      expectedValue: 'three',
    },
    'single select > options with number values > should set value of input as value prop': {
      props: {
        ...BASIC_PROPS,
        options: OPTIONS_NUMBER_VALUE,
        value: OPTIONS_NUMBER_VALUE[3],
      },
      expectedValue: 3,
    },
    'single select > options with boolean values > should set value of input as value prop': {
      props: {
        ...BASIC_PROPS,
        options: OPTIONS_BOOLEAN_VALUE,
        value: OPTIONS_BOOLEAN_VALUE[1],
      },
      expectedValue: false,
    },
    'multi select > should set value of input as value prop': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        value: OPTIONS[3],
      },
      expectedValue: 'three',
    },
    'multi select > with delimiter prop > should set value of input as value prop': {
      props: {
        ...BASIC_PROPS,
        delimiter: ', ',
        isMulti: true,
        value: [OPTIONS[3], OPTIONS[5]],
      },
      expectedValue: 'three, five',
    },
    'multi select > options with number values > should set value of input as value prop': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        options: OPTIONS_NUMBER_VALUE,
        value: OPTIONS_NUMBER_VALUE[3],
      },
      expectedValue: 3,
    },
    'multi select > with delimiter prop > options with number values > should set value of input as value prop': {
      props: {
        ...BASIC_PROPS,
        delimiter: ', ',
        isMulti: true,
        options: OPTIONS_NUMBER_VALUE,
        value: [OPTIONS_NUMBER_VALUE[3], OPTIONS_NUMBER_VALUE[1]],
      },
      expectedValue: '3, 1',
    },
    'multi select > options with boolean values > should set value of input as value prop': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        options: OPTIONS_BOOLEAN_VALUE,
        value: OPTIONS_BOOLEAN_VALUE[1],
      },
      expectedValue: false,
    },
    'multi select > with delimiter prop > options with boolean values > should set value of input as value prop': {
      props: {
        ...BASIC_PROPS,
        delimiter: ', ',
        isMulti: true,
        options: OPTIONS_BOOLEAN_VALUE,
        value: [OPTIONS_BOOLEAN_VALUE[1], OPTIONS_BOOLEAN_VALUE[0]],
      },
      expectedValue: 'false, true',
    },
  }
);

cases(
  'isOptionDisabled() prop',
  ({ props, expectedEnabledOption, expectedDisabledOption }) => {
    let selectWrapper = mount(<Select {...props} />);

    const enabledOptions = selectWrapper
      .find('Option[isDisabled=false]')
      .filterWhere(n => !n.props().isDisabled);
    const enabledOptionsValues = enabledOptions.map(option => option.text());
    enabledOptionsValues.map(option => {
      expect(expectedDisabledOption.indexOf(option)).toBe(-1);
    });

    const disabledOptions = selectWrapper
      .find('Option[isDisabled=false]')
      .filterWhere(n => n.props().isDisabled);
    const disabledOptionsValues = disabledOptions.map(option => option.text());
    disabledOptionsValues.map(option => {
      expect(expectedEnabledOption.indexOf(option)).toBe(-1);
    });
  },
  {
    'single select > should add isDisabled as true prop only to options that are disabled': {
      props: {
        ...BASIC_PROPS,
        menuIsOpen: true,
        isOptionDisabled: option =>
          ['zero', 'two', 'five', 'ten'].indexOf(option.value) > -1,
      },
      expectedEnabledOption: ['1', '3', '11'],
      expectedDisabledOption: ['0', '2', '5'],
    },
    'multi select > should add isDisabled as true prop only to options that are disabled': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        menuIsOpen: true,
        isOptionDisabled: option =>
          ['zero', 'two', 'five', 'ten'].indexOf(option.value) > -1,
      },
      expectedEnabledOption: ['1', '3', '11'],
      expectedDisabledOption: ['0', '2', '5'],
    },
  }
);

cases(
  'isDisabled prop',
  ({ props }) => {
    let selectWrapper = mount(<Select {...props} />);
    expect(selectWrapper.props().isDisabled).toBeTruthy();

    let controlWrapper = selectWrapper.find(Control);
    expect(controlWrapper.props().isDisabled).toBeTruthy();

    let valueWrapper = selectWrapper.find(ValueContainer);
    expect(valueWrapper.props().isDisabled).toBeTruthy();

    let indicatorsContainerWrapper = selectWrapper.find(IndicatorsContainer);
    expect(indicatorsContainerWrapper.props().isDisabled).toBeTruthy();

    let DropdownIndicatorWrapper = selectWrapper.find(DropdownIndicator);
    expect(DropdownIndicatorWrapper.props().isDisabled).toBeTruthy();
  },
  {
    'single select > should add isDisabled prop to select components': {
      props: {
        ...BASIC_PROPS,
        isDisabled: true,
      },
    },
    'multi select > should add isDisabled prop to select components': {
      props: {
        ...BASIC_PROPS,
        isDisabled: true,
        isMulti: true,
      },
    },
  }
);

test('hitting Enter on option should not call onChange if the event comes from IME', () => {
  let spy = jest.fn();
  let selectWrapper = mount(
    <Select
      className="react-select"
      classNamePrefix="react-select"
      menuIsOpen
      onChange={spy}
      onInputChange={jest.fn()}
      onMenuClose={jest.fn()}
      options={OPTIONS}
      tabSelectsValue={false}
    />
  );

  let selectOption = selectWrapper.find('div.react-select__option').at(0);
  selectWrapper.setState({ focusedOption: { label: '2', value: 'two' } });

  selectOption.simulate('keyDown', { keyCode: 229, key: 'Enter' });
  expect(spy).not.toHaveBeenCalled();
});

test('hitting tab on option should not call onChange if tabSelectsValue is false', () => {
  let spy = jest.fn();
  let selectWrapper = mount(
    <Select
      className="react-select"
      classNamePrefix="react-select"
      menuIsOpen
      onChange={spy}
      onInputChange={jest.fn()}
      onMenuClose={jest.fn()}
      options={OPTIONS}
      tabSelectsValue={false}
    />
  );

  let selectOption = selectWrapper.find('div.react-select__option').at(0);
  selectWrapper.setState({ focusedOption: { label: '2', value: 'two' } });

  selectOption.simulate('keyDown', { keyCode: 9, key: 'Tab' });
  expect(spy).not.toHaveBeenCalled();
});

test('multi select > to not show selected value in options', () => {
  let onInputChangeSpy = jest.fn();
  let onMenuCloseSpy = jest.fn();
  let selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      isMulti
      menuIsOpen
      onInputChange={onInputChangeSpy}
      onMenuClose={onMenuCloseSpy}
    />
  );

  let availableOptions = selectWrapper
    .find(Option)
    .map(option => option.text());
  expect(availableOptions.indexOf('0') > -1).toBeTruthy();

  selectWrapper.setProps({ value: OPTIONS[0] });

  // Re-open Menu
  selectWrapper
    .find('div.react-select__dropdown-indicator')
    .simulate('mouseDown', { button: 0 });
  availableOptions = selectWrapper.find(Option).map(option => option.text());

  expect(availableOptions.indexOf('0') > -1).toBeFalsy();
});

test('multi select > to not hide the selected options from the menu if hideSelectedOptions is false', () => {
  let selectWrapper = mount(
    <Select
      className="react-select"
      classNamePrefix="react-select"
      hideSelectedOptions={false}
      isMulti
      menuIsOpen
      onChange={jest.fn()}
      onInputChange={jest.fn()}
      onMenuClose={jest.fn()}
      options={OPTIONS}
    />
  );
  let firstOption = selectWrapper.find(Option).at(0);
  let secondoption = selectWrapper.find(Option).at(1);
  expect(firstOption.text()).toBe('0');
  expect(secondoption.text()).toBe('1');

  firstOption.find('div.react-select__option').simulate('click', { button: 0 });

  expect(firstOption.text()).toBe('0');
  expect(secondoption.text()).toBe('1');
});

test('multi select > call onChange with all values but last selected value and remove event on hitting backspace', () => {
  let onChangeSpy = jest.fn();
  let selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      isMulti
      onChange={onChangeSpy}
      value={[OPTIONS[0], OPTIONS[1], OPTIONS[2]]}
    />
  );
  expect(selectWrapper.find(Control).text()).toBe('012');

  selectWrapper
    .find(Control)
    .simulate('keyDown', { keyCode: 8, key: 'Backspace' });
  expect(onChangeSpy).toHaveBeenCalledWith(
    [{ label: '0', value: 'zero' }, { label: '1', value: 'one' }],
    { action: 'pop-value', removedValue: { label: '2', value: 'two' }, name: BASIC_PROPS.name },
  );
});

test('should not call onChange on hitting backspace when backspaceRemovesValue is false', () => {
  let onChangeSpy = jest.fn();
  let selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      backspaceRemovesValue={false}
      onChange={onChangeSpy}
    />
  );
  selectWrapper
    .find(Control)
    .simulate('keyDown', { keyCode: 8, key: 'Backspace' });
  expect(onChangeSpy).not.toHaveBeenCalled();
});

test('should not call onChange on hitting backspace even when backspaceRemovesValue is true if isClearable is false', () => {
  let onChangeSpy = jest.fn();
  let selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      backspaceRemovesValue
      isClearable={false}
      onChange={onChangeSpy}
    />
  );
  selectWrapper
    .find(Control)
    .simulate('keyDown', { keyCode: 8, key: 'Backspace' });
  expect(onChangeSpy).not.toHaveBeenCalled();
});

cases('should call onChange with `null` on hitting backspace when backspaceRemovesValue is true', ({ props = { ...BASIC_PROPS }, expectedValue }) => {
  let onChangeSpy = jest.fn();
  let selectWrapper = mount(
    <Select
      {...props}
      backspaceRemovesValue
      isClearable
      onChange={onChangeSpy}
    />
  );
  selectWrapper
    .find(Control)
    .simulate('keyDown', { keyCode: 8, key: 'Backspace' });
  expect(onChangeSpy).toHaveBeenCalledWith(null, expectedValue);
}, {
  'and isMulti is false': {
    props: {
      ...BASIC_PROPS,
      isMulti: false,
    },
    expectedValue: {
      action: 'clear',
      name: 'test-input-name',
    }
  },
  'and isMulti is true': {
    props: {
      ...BASIC_PROPS,
      isMulti: true,
    },
    expectedValue: {
      action: 'pop-value',
      name: 'test-input-name',
      removedValue: undefined
    }
  },
});


test('multi select > clicking on X next to option will call onChange with all options other that the clicked option', () => {
  let onChangeSpy = jest.fn();
  let selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      isMulti
      onChange={onChangeSpy}
      value={[OPTIONS[0], OPTIONS[2], OPTIONS[4]]}
    />
  );
  // there are 3 values in select
  expect(selectWrapper.find(MultiValue).length).toBe(3);

  const selectValueWrapper = selectWrapper
    .find(MultiValue)
    .filterWhere(multiValue => multiValue.text() === '4');
  selectValueWrapper
    .find('div.react-select__multi-value__remove')
    .simulate('click', { button: 0 });

  expect(onChangeSpy).toHaveBeenCalledWith(
    [{ label: '0', value: 'zero' }, { label: '2', value: 'two' }],
    { action: 'remove-value', removedValue: { label: '4', value: 'four' }, name: BASIC_PROPS.name }
  );
});

/**
 * TODO: Need to get hightlight a menu option and then match value with aria-activedescendant prop
 */
cases(
  'accessibility > aria-activedescendant',
  ({ props = { ...BASIC_PROPS } }) => {
    let selectWrapper = mount(<Select {...props} menuIsOpen />);

    selectWrapper
      .find(Menu)
      .simulate('keyDown', { keyCode: 40, key: 'ArrowDown' });
    expect(
      selectWrapper.find('Control input').props()['aria-activedescendant']
    ).toBe('1');
  },
  {
    'single select > should update aria-activedescendant as per focused option': {
      skip: true,
    },
    'multi select > should update aria-activedescendant as per focused option': {
      skip: true,
      props: {
        ...BASIC_PROPS,
        value: { label: '2', value: 'two' },
      },
    },
  }
);

cases(
  'accessibility > passes through aria-labelledby prop',
  ({ props = { ...BASIC_PROPS, 'aria-labelledby': 'testing' } }) => {
    let selectWrapper = mount(<Select {...props} />);
    expect(selectWrapper.find('Control input').props()['aria-labelledby']).toBe(
      'testing'
    );
  },
  {
    'single select > should pass aria-labelledby prop down to input': {},
    'multi select > should pass aria-labelledby prop down to input': {
      props: {
        ...BASIC_PROPS,
        'aria-labelledby': 'testing',
        isMulti: true,
      },
    },
  }
);

cases(
  'accessibility > passes through aria-label prop',
  ({ props = { ...BASIC_PROPS, 'aria-label': 'testing' } }) => {
    let selectWrapper = mount(<Select {...props} />);
    expect(selectWrapper.find('Control input').props()['aria-label']).toBe(
      'testing'
    );
  },
  {
    'single select > should pass aria-labelledby prop down to input': {},
    'multi select > should pass aria-labelledby prop down to input': {
      props: {
        ...BASIC_PROPS,
        'aria-label': 'testing',
        isMulti: true,
      },
    },
  }
);

test('accessibility > to show the number of options available in A11yText when the menu is Open', () => {
  let selectWrapper = mount(<Select {...BASIC_PROPS} inputValue={''} autoFocus menuIsOpen />);
  const liveRegionId = '#aria-context';
  selectWrapper.setState({ isFocused: true });
  selectWrapper.update();
  expect(selectWrapper.find(liveRegionId).text()).toMatch(/17 results available/);

  selectWrapper.setProps({ inputValue: '0' });
  expect(selectWrapper.find(liveRegionId).text()).toMatch(/2 results available/);

  selectWrapper.setProps({ inputValue: '10' });
  expect(selectWrapper.find(liveRegionId).text()).toMatch(/1 result available/);

  selectWrapper.setProps({ inputValue: '100' });
  expect(selectWrapper.find(liveRegionId).text()).toMatch(/0 results available/);
});

test('accessibility > interacting with disabled options shows correct A11yText', () => {
  let selectWrapper = mount(<Select {...BASIC_PROPS} options={OPTIONS_DISABLED} inputValue={''} autoFocus menuIsOpen />);
  const liveRegionId = '#aria-context';
  const liveRegionEventId = '#aria-selection-event';
  selectWrapper.setState({ isFocused: true });
  selectWrapper.update();

  // navigate to disabled option
  selectWrapper
  .find(Menu)
  .simulate('keyDown', { keyCode: 40, key: 'ArrowDown' })
  .simulate('keyDown', { keyCode: 40, key: 'ArrowDown' });

  expect(selectWrapper.find(liveRegionId).text()).toMatch(
    'option 1 focused disabled, 2 of 17. 17 results available. Use Up and Down to choose options, press Escape to exit the menu, press Tab to select the option and exit the menu.'
  );

  // attempt to select disabled option
  selectWrapper
  .find(Menu)
  .simulate('keyDown', { keyCode: 13, key: 'Enter' });

  expect(selectWrapper.find(liveRegionEventId).text()).toMatch(
    'option 1 is disabled. Select another option.'
  );
});

test('accessibility > screenReaderStatus function prop > to pass custom text to A11yText', () => {
  const screenReaderStatus = ({ count }) =>
    `There are ${count} options available`;

  const liveRegionId = '#aria-context';
  let selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      inputValue={''}
      screenReaderStatus={screenReaderStatus}
      menuIsOpen
    />
  );
  selectWrapper.setState({ isFocused: true });
  selectWrapper.update();

  expect(selectWrapper.find(liveRegionId).text()).toMatch(
    'There are 17 options available'
  );

  selectWrapper.setProps({ inputValue: '0' });
  expect(selectWrapper.find(liveRegionId).text()).toMatch(
    'There are 2 options available'
  );

  selectWrapper.setProps({ inputValue: '10' });
  expect(selectWrapper.find(liveRegionId).text()).toMatch(
    'There are 1 options available'
  );

  selectWrapper.setProps({ inputValue: '100' });
  expect(selectWrapper.find(liveRegionId).text()).toMatch(
    'There are 0 options available'
  );
});

test('closeMenuOnSelect prop > when passed as false it should not call onMenuClose on selecting option', () => {
  let onMenuCloseSpy = jest.fn();
  const props = { ...BASIC_PROPS, onMenuClose: onMenuCloseSpy };
  let selectWrapper = mount(
    <Select {...props} menuIsOpen closeMenuOnSelect={false} />
  );
  selectWrapper
    .find('div.react-select__option')
    .at(0)
    .simulate('click', { button: 0 });
  expect(onMenuCloseSpy).not.toHaveBeenCalled();
});

/**
 * TODO: Delete after confirmation - Not a case anymore, not getting this label in V2
 */
test.skip('accessibility > multi select > remove value label', () => {
  const props = {
    ...BASIC_PROPS,
    isMulti: true,
    value: [OPTIONS[0], OPTIONS[1]],
  };
  let selectWrapper = mount(<Select {...props} />);
  expect(selectWrapper).toBeTruthy();
});

cases(
  'autoFocus',
  ({ props = { ...BASIC_PROPS, autoFocus: true } }) => {
    let selectWrapper = mount(<Select {...props} />);
    expect(selectWrapper.find('Control input').props().id).toBe(
      document.activeElement.id
    );
  },
  {
    'single select > should focus select on mount': {},
    'multi select > should focus select on mount': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        autoFocus: true,
      },
    },
  }
);

/**
 * onFocus hook is not being called when component is mounted is autoFocus true
 * Reproducible here ->  https://codesandbox.io/s/71xrkj0qj
 */
cases(
  'onFocus prop with autoFocus',
  ({ props = { ...BASIC_PROPS, autoFocus: true } }) => {
    let onFocusSpy = jest.fn();
    let selectWrapper = mount(<Select {...props} onFocus={onFocusSpy} />);
    expect(selectWrapper.find('Control input').props().id).toBe(
      document.activeElement.id
    );
    expect(onFocusSpy).toHaveBeenCalledTimes(1);
  },
  {
    'single select > should call auto focus only once when select is autoFocus': {
      skip: true,
    },
    'multi select > should call auto focus only once when select is autoFocus': {
      skip: true,
      props: {
        ...BASIC_PROPS,
        autoFocus: true,
        isMulti: true,
      },
    },
  }
);

cases(
  'onFocus prop is called on on focus of input',
  ({ props = { ...BASIC_PROPS } }) => {
    let onFocusSpy = jest.fn();
    let selectWrapper = mount(<Select {...props} onFocus={onFocusSpy} />);
    selectWrapper.find('Control input').simulate('focus');
    expect(onFocusSpy).toHaveBeenCalledTimes(1);
  },
  {
    'single select > should call onFocus handler on focus on input': {},
    'multi select > should call onFocus handler on focus on input': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
    },
  }
);

cases(
  'onBlur prop',
  ({ props = { ...BASIC_PROPS } }) => {
    let onBlurSpy = jest.fn();
    let selectWrapper = mount(
      <Select
        {...props}
        onBlur={onBlurSpy}
        onInputChange={jest.fn()}
        onMenuClose={jest.fn()}
      />
    );
    selectWrapper.find('Control input').simulate('blur');
    expect(onBlurSpy).toHaveBeenCalledTimes(1);
  },
  {
    'single select > should call onBlur handler on blur on input': {},
    'multi select > should call onBlur handler on blur on input': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
    },
  }
);

test('onInputChange() function prop to be called on blur', () => {
  let onInputChangeSpy = jest.fn();
  let selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      onBlur={jest.fn()}
      onInputChange={onInputChangeSpy}
      onMenuClose={jest.fn()}
    />
  );
  selectWrapper.find('Control input').simulate('blur');
  // Once by blur and other time by menu-close
  expect(onInputChangeSpy).toHaveBeenCalledTimes(2);
});

test('onMenuClose() function prop to be called on blur', () => {
  let onMenuCloseSpy = jest.fn();
  let selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      onBlur={jest.fn()}
      onInputChange={jest.fn()}
      onMenuClose={onMenuCloseSpy}
    />
  );
  selectWrapper.find('Control input').simulate('blur');
  expect(onMenuCloseSpy).toHaveBeenCalledTimes(1);
});

cases(
  'placeholder',
  ({ props, expectPlaceholder = 'Select...' }) => {
    let selectWrapper = mount(<Select {...props} />);
    expect(selectWrapper.find('Control').text()).toBe(expectPlaceholder);
  },
  {
    'single select > should display default placeholder "Select..."': {},
    'single select > should display provided string placeholder': {
      props: {
        ...BASIC_PROPS,
        placeholder: 'single Select...',
      },
      expectPlaceholder: 'single Select...',
    },
    'single select > should display provided node placeholder': {
      props: {
        ...BASIC_PROPS,
        placeholder: <span>single Select...</span>,
      },
      expectPlaceholder: 'single Select...',
    },
    'multi select > should display default placeholder "Select..."': {
      props: {
        ...BASIC_PROPS,
        isMulti: true
      }
    },
    'multi select > should display provided placeholder': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        placeholder: 'multi Select...',
      },
      expectPlaceholder: 'multi Select...',
    },
  }
);

cases(
  'display placeholder once value is removed',
  ({ props }) => {
    let selectWrapper = mount(<Select {...props} />);
    expect(selectWrapper.find(Placeholder).exists()).toBeFalsy();
    selectWrapper.setProps({ value: '' });
    expect(selectWrapper.find(Placeholder).exists()).toBeTruthy();
  },
  {
    'single select > should display placeholder once the value is removed from select': {
      props: {
        ...BASIC_PROPS,
        value: OPTIONS[0],
      },
    },
    'multi select > should display placeholder once the value is removed from select': {
      props: {
        ...BASIC_PROPS,
        value: OPTIONS[0],
      },
    },
  }
);

test('renders a read only input when isSearchable is false', () => {
  let selectWrapper = mount(<Select options={OPTIONS} isSearchable={false} />);
  let inputWrapper = selectWrapper.find('Control input');
  expect(inputWrapper.props().readOnly).toBe(true);
});

cases(
  'clicking on disabled option',
  ({ props = BASIC_PROPS, optionsSelected }) => {
    let onChangeSpy = jest.fn();
    props = { ...props, onChange: onChangeSpy };
    let selectWrapper = mount(<Select {...props} menuIsOpen />);
    let selectOption = selectWrapper
      .find('div.react-select__option')
      .findWhere(n => n.props().children === optionsSelected);
    selectOption.simulate('click', { button: 0 });
    expect(onChangeSpy).not.toHaveBeenCalled();
  },
  {
    'single select > should not select the disabled option': {
      props: {
        ...BASIC_PROPS,
        options: [
          { label: 'option 1', value: 'opt1' },
          { label: 'option 2', value: 'opt2', isDisabled: true },
        ],
      },
      optionsSelected: 'option 2',
    },
    'multi select > should not select the disabled option': {
      props: {
        ...BASIC_PROPS,
        options: [
          { label: 'option 1', value: 'opt1' },
          { label: 'option 2', value: 'opt2', isDisabled: true },
        ],
      },
      optionsSelected: 'option 2',
    },
  }
);

cases(
  'pressing enter on disabled option',
  ({ props = BASIC_PROPS, optionsSelected }) => {
    let onChangeSpy = jest.fn();
    props = { ...props, onChange: onChangeSpy };
    let selectWrapper = mount(<Select {...props} menuIsOpen />);
    let selectOption = selectWrapper
      .find('div.react-select__option')
      .findWhere(n => n.props().children === optionsSelected);
    selectOption.simulate('keyDown', { keyCode: 13, key: 'Enter' });
    expect(onChangeSpy).not.toHaveBeenCalled();
  },
  {
    'single select > should not select the disabled option': {
      props: {
        ...BASIC_PROPS,
        options: [
          { label: 'option 1', value: 'opt1' },
          { label: 'option 2', value: 'opt2', isDisabled: true },
        ],
      },
      optionsSelected: 'option 2',
    },
    'multi select > should not select the disabled option': {
      props: {
        ...BASIC_PROPS,
        options: [
          { label: 'option 1', value: 'opt1' },
          { label: 'option 2', value: 'opt2', isDisabled: true },
        ],
      },
      optionsSelected: 'option 2',
    },
  }
);

test('does not select anything when a disabled option is the only item in the list after a search', () => {
  let onChangeSpy = jest.fn();
  const options = [
    { label: 'opt', value: 'opt1', isDisabled: true },
    ...OPTIONS,
  ];
  const props = { ...BASIC_PROPS, onChange: onChangeSpy, options };
  // Getting error trying to change unControlled component to controlled
  // so passing inputValue
  let selectWrapper = mount(<Select {...props} menuIsOpen inputValue="" />);
  selectWrapper.setProps({ inputValue: 'opt' });
  selectWrapper.find(Menu).simulate('keyDown', { keyCode: 13, key: 'Enter' });

  expect(onChangeSpy).not.toHaveBeenCalled();
  // Menu is still open
  expect(selectWrapper.find(Option).text()).toBe('opt');
});

test('render custom Input Component', () => {
  const InputComponent = () => <div />;
  let selectWrapper = mount(
    <Select {...BASIC_PROPS} components={{ Input: InputComponent }} />
  );

  expect(selectWrapper.find(Input).exists()).toBeFalsy();
  expect(selectWrapper.find(InputComponent).exists()).toBeTruthy();
});

test('render custom Menu Component', () => {
  const MenuComponent = () => <div />;
  let selectWrapper = mount(
    <Select {...BASIC_PROPS} menuIsOpen components={{ Menu: MenuComponent }} />
  );

  expect(selectWrapper.find(Menu).exists()).toBeFalsy();
  expect(selectWrapper.find(MenuComponent).exists()).toBeTruthy();
});

test('render custom Option Component', () => {
  const OptionComponent = () => <div />;
  let selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      components={{ Option: OptionComponent }}
      menuIsOpen
    />
  );

  expect(selectWrapper.find(Option).exists()).toBeFalsy();
  expect(selectWrapper.find(OptionComponent).exists()).toBeTruthy();
});

cases(
  'isClearable is false',
  ({ props = BASIC_PROPS }) => {
    let selectWrapper = mount(<Select {...props} />);
    expect(selectWrapper.find(ClearIndicator).exists()).toBeFalsy();
  },
  {
    'single select > should not show the X (clear) button': {
      props: {
        ...BASIC_PROPS,
        isClearable: false,
        value: OPTIONS[0],
      },
    },
    'multi select > should not show X (clear) button': {
      ...BASIC_PROPS,
      isMulti: true,
      isClearable: false,
      value: [OPTIONS[0]],
    },
  }
);

test('clear select by clicking on clear button > should not call onMenuOpen', () => {
  let onChangeSpy = jest.fn();
  let props = { ...BASIC_PROPS, onChange: onChangeSpy };
  let selectWrapper = mount(<Select {...props} isMulti value={[OPTIONS[0]]} />);

  expect(selectWrapper.find(MultiValue).length).toBe(1);
  selectWrapper
    .find('div.react-select__clear-indicator')
    .simulate('mousedown', { button: 0 });
  expect(onChangeSpy).toBeCalledWith([], { action: 'clear', name: BASIC_PROPS.name });
});

test('clearing select using clear button to not call onMenuOpen or onMenuClose', () => {
  let onMenuCloseSpy = jest.fn();
  let onMenuOpenSpy = jest.fn();
  let props = {
    ...BASIC_PROPS,
    onMenuClose: onMenuCloseSpy,
    onMenuOpen: onMenuOpenSpy,
  };
  let selectWrapper = mount(<Select {...props} isMulti value={[OPTIONS[0]]} />);
  expect(selectWrapper.find(MultiValue).length).toBe(1);
  selectWrapper
    .find('div.react-select__clear-indicator')
    .simulate('mousedown', { button: 0 });
  expect(onMenuOpenSpy).not.toHaveBeenCalled();
  expect(onMenuCloseSpy).not.toHaveBeenCalled();
});

test('multi select >  calls onChange when option is selected and isSearchable is false', () => {
  let onChangeSpy = jest.fn();
  let props = { ...BASIC_PROPS, onChange: onChangeSpy };
  let selectWrapper = mount(
    <Select {...props} isMulti menuIsOpen delimiter="," isSearchable={false} />
  );
  selectWrapper
    .find('div.react-select__option')
    .at(0)
    .simulate('click', { button: 0 });
  const selectedOption = { label: '0', value: 'zero' };
  expect(onChangeSpy).toHaveBeenCalledWith([selectedOption], {
    action: 'select-option',
    option: selectedOption,
    name: BASIC_PROPS.name
  });
});

test('getOptionLabel() prop > to format the option label', () => {
  const getOptionLabel = option => `This a custom option ${option.label} label`;
  const selectWrapper = mount(
    <Select {...BASIC_PROPS} menuIsOpen getOptionLabel={getOptionLabel} />
  );
  expect(
    selectWrapper
      .find(Option)
      .at(0)
      .text()
  ).toBe('This a custom option 0 label');
});

test('formatGroupLabel function prop > to format Group label', () => {
  const formatGroupLabel = group => `This is custom ${group.label} header`;
  const options = [
    {
      label: 'group 1',
      options: [{ value: 1, label: '1' }, { value: 2, label: '2' }],
    },
  ];
  const selectWrapper = mount(
    <Select options={options} menuIsOpen formatGroupLabel={formatGroupLabel} />
  );
  expect(selectWrapper.find(GroupHeading).text()).toBe(
    'This is custom group 1 header'
  );
});

test('to only render groups with at least one match when filtering', () => {
  const options = [
    {
      label: 'group 1',
      options: [{ value: 1, label: '1' }, { value: 2, label: '2' }],
    },
    {
      label: 'group 2',
      options: [{ value: 3, label: '3' }, { value: 4, label: '4' }],
    },
  ];
  const selectWrapper = mount(
    <Select options={options} menuIsOpen inputValue="" />
  );
  selectWrapper.setProps({ inputValue: '1' });

  expect(selectWrapper.find('Group').length).toBe(1);
  expect(selectWrapper.find('Group').find('Option').length).toBe(1);
});

test('not render any groups when there is not a single match when filtering', () => {
  const options = [
    {
      label: 'group 1',
      options: [{ value: 1, label: '1' }, { value: 2, label: '2' }],
    },
    {
      label: 'group 2',
      options: [{ value: 3, label: '3' }, { value: 4, label: '4' }],
    },
  ];
  const selectWrapper = mount(
    <Select options={options} menuIsOpen inputValue="" />
  );
  selectWrapper.setProps({ inputValue: '5' });

  expect(selectWrapper.find('Group').length).toBe(0);
});

test('multi select > have default value delimiter seperated', () => {
  let selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      delimiter={';'}
      isMulti
      value={[OPTIONS[0], OPTIONS[1]]}
    />
  );
  expect(selectWrapper.find('input[type="hidden"]').props().value).toBe(
    'zero;one'
  );
});

test('multi select > with multi character delimiter', () => {
  let selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      delimiter={'===&==='}
      isMulti
      value={[OPTIONS[0], OPTIONS[1]]}
    />
  );
  expect(selectWrapper.find('input[type="hidden"]').props().value).toBe(
    'zero===&===one'
  );
});

test('hitting spacebar should select option if isSearchable is false', () => {
  let onChangeSpy = jest.fn();
  let props = { ...BASIC_PROPS, onChange: onChangeSpy };
  let selectWrapper = mount(<Select {...props} isSearchable menuIsOpen />);
  // focus the first option
  selectWrapper
    .find(Menu)
    .simulate('keyDown', { keyCode: 40, key: 'ArrowDown' });
  selectWrapper.simulate('keyDown', { keyCode: 32, key: ' ' });
  expect(onChangeSpy).toHaveBeenCalledWith(
    { label: '0', value: 'zero' },
    { action: 'select-option', name: BASIC_PROPS.name }
  );
});

test('hitting escape does not call onChange if menu is Open', () => {
  let onChangeSpy = jest.fn();
  let props = { ...BASIC_PROPS, onChange: onChangeSpy };
  let selectWrapper = mount(
    <Select {...props} menuIsOpen escapeClearsValue isClearable />
  );

  // focus the first option
  selectWrapper
    .find(Menu)
    .simulate('keyDown', { keyCode: 40, key: 'ArrowDown' });
  selectWrapper.simulate('keyDown', { keyCode: 27, key: 'Escape' });
  expect(onChangeSpy).not.toHaveBeenCalled();
});

test('multi select > removes the selected option from the menu options when isSearchable is false', () => {
  let selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      delimiter=","
      isMulti
      isSearchable={false}
      menuIsOpen
    />
  );
  expect(selectWrapper.find(Option).length).toBe(17);
  selectWrapper.setProps({ value: OPTIONS[0] });
  // expect '0' to not be options
  selectWrapper.find(Option).map(option => {
    expect(option.text()).not.toBe('0');
  });
  expect(selectWrapper.find(Option).length).toBe(16);
});

test('hitting ArrowUp key on closed select should focus last element', () => {
  let selectWrapper = mount(<Select {...BASIC_PROPS} menuIsOpen />);
  selectWrapper
    .find('div.react-select__control')
    .simulate('keyDown', { keyCode: 38, key: 'ArrowUp' });
  expect(selectWrapper.state('focusedOption')).toEqual({
    label: '16',
    value: 'sixteen',
  });
});

test('close menu on hitting escape and clear input value if menu is open even if escapeClearsValue and isClearable are true', () => {
  let onMenuCloseSpy = jest.fn();
  let onInputChangeSpy = jest.fn();
  let props = {
    ...BASIC_PROPS,
    onInputChange: onInputChangeSpy,
    onMenuClose: onMenuCloseSpy,
    value: OPTIONS[0],
  };
  let selectWrapper = mount(
    <Select {...props} menuIsOpen escapeClearsValue isClearable />
  );
  selectWrapper.simulate('keyDown', { keyCode: 27, key: 'Escape' });
  expect(selectWrapper.state('selectValue')).toEqual([
    { label: '0', value: 'zero' },
  ]);
  expect(onMenuCloseSpy).toHaveBeenCalled();
  // once by onMenuClose and other is direct
  expect(onInputChangeSpy).toHaveBeenCalledTimes(2);
  expect(onInputChangeSpy).toHaveBeenCalledWith('', { action: 'menu-close' });
  expect(onInputChangeSpy).toHaveBeenLastCalledWith('', {
    action: 'menu-close',
  });
});

test('to not clear value when hitting escape if escapeClearsValue is false (default) and isClearable is false', () => {
  let onChangeSpy = jest.fn();
  let props = { ...BASIC_PROPS, onChange: onChangeSpy, value: OPTIONS[0] };
  let selectWrapper = mount(
    <Select {...props} escapeClearsValue isClearable={false} />
  );

  selectWrapper.simulate('keyDown', { keyCode: 27, key: 'Escape' });
  expect(onChangeSpy).not.toHaveBeenCalled();
});

test('to not clear value when hitting escape if escapeClearsValue is true and isClearable is false', () => {
  let onChangeSpy = jest.fn();
  let props = { ...BASIC_PROPS, onChange: onChangeSpy, value: OPTIONS[0] };
  let selectWrapper = mount(
    <Select {...props} escapeClearsValue isClearable={false} />
  );

  selectWrapper.simulate('keyDown', { keyCode: 27, key: 'Escape' });
  expect(onChangeSpy).not.toHaveBeenCalled();
});

test('to not clear value when hitting escape if escapeClearsValue is false (default) and isClearable is true', () => {
  let onChangeSpy = jest.fn();
  let props = { ...BASIC_PROPS, onChange: onChangeSpy, value: OPTIONS[0] };
  let selectWrapper = mount(<Select {...props} isClearable />);

  selectWrapper.simulate('keyDown', { keyCode: 27, key: 'Escape' });
  expect(onChangeSpy).not.toHaveBeenCalled();
});

test('to clear value when hitting escape if escapeClearsValue and isClearable are true', () => {
  let onInputChangeSpy = jest.fn();
  let props = { ...BASIC_PROPS, onChange: onInputChangeSpy, value: OPTIONS[0] };
  let selectWrapper = mount(
    <Select {...props} isClearable escapeClearsValue />
  );

  selectWrapper.simulate('keyDown', { keyCode: 27, key: 'Escape' });
  expect(onInputChangeSpy).toHaveBeenCalledWith(null, { action: 'clear', name: BASIC_PROPS.name });
});

/**
 * Selects the option on hitting spacebar on V2
 * Needs varification
 */
test.skip('hitting spacebar should not select option if isSearchable is true (default)', () => {
  let onChangeSpy = jest.fn();
  let props = { ...BASIC_PROPS, onChange: onChangeSpy };
  let selectWrapper = mount(<Select {...props} menuIsOpen />);
  // Open Menu
  selectWrapper.setState({ focusedOption: OPTIONS[0] });
  selectWrapper.simulate('keyDown', { keyCode: 32, key: ' ' });
  expect(onChangeSpy).not.toHaveBeenCalled();
});


test('renders with custom theme', () => {
  const primary = 'rgb(255, 164, 83)';
  const selectWrapper = mount(
    <Select
      {...BASIC_PROPS}
      value={OPTIONS[0]}
      menuIsOpen
      theme={(theme) => (
        {
          ...theme,
          borderRadius: 180,
          colors: {
            ...theme.colors,
            primary,
          },
        }
      )} />
  );
  const menu = selectWrapper.find(Menu);
  expect(window.getComputedStyle(menu.getDOMNode()).getPropertyValue('border-radius')).toEqual('180px');
  const firstOption = selectWrapper.find(Option).first();
  expect(window.getComputedStyle(firstOption.getDOMNode()).getPropertyValue('background-color')).toEqual(primary);
});

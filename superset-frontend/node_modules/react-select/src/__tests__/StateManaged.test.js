import React from 'react';
import { shallow, mount } from 'enzyme';
import toJson from 'enzyme-to-json';
import cases from 'jest-in-case';

import { OPTIONS } from './constants';
import Select from '../';
import SelectBase from '../Select';
import { components } from '../components';

const { Control, Menu } = components;

const BASIC_PROPS = {
  className: 'react-select',
  classNamePrefix: 'react-select',
  options: OPTIONS,
  name: 'test-input-name',
};

test('defaults > snapshot', () => {
  const tree = shallow(<Select />);
  expect(toJson(tree)).toMatchSnapshot();
});

test('passes down the className prop', () => {
  let selectWrapper = mount(<Select {...BASIC_PROPS} className="test-class" />);
  expect(selectWrapper.find(SelectBase).props().className).toBe('test-class');
});

cases(
  'click on dropdown indicator',
  ({ props = BASIC_PROPS }) => {
    let selectWrapper = mount(<Select {...props} />);
    // Menu not open by defualt
    expect(selectWrapper.find(Menu).exists()).toBeFalsy();
    // Open Menu
    selectWrapper
      .find('div.react-select__dropdown-indicator')
      .simulate('mouseDown', { button: 0 });
    expect(selectWrapper.find(Menu).exists()).toBeTruthy();

    // close open menu
    selectWrapper
      .find('div.react-select__dropdown-indicator')
      .simulate('mouseDown', { button: 0 });
    expect(selectWrapper.find(Menu).exists()).toBeFalsy();
  },
  {
    'single select > should toggle Menu': {},
    'multi select > should toggle Menu': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
    },
  }
);

test('If menuIsOpen prop is passed Menu should not close on clicking Dropdown Indicator', () => {
  let selectWrapper = mount(<Select {...BASIC_PROPS} menuIsOpen />);
  expect(selectWrapper.find(Menu).exists()).toBeTruthy();

  selectWrapper
    .find('div.react-select__dropdown-indicator')
    .simulate('mouseDown', { button: 0 });
  expect(selectWrapper.find(Menu).exists()).toBeTruthy();
});

test('defaultMenuIsOpen prop > should open by menu default and clicking on Dropdown Indicator should toggle menu', () => {
  let selectWrapper = mount(<Select {...BASIC_PROPS} defaultMenuIsOpen />);
  expect(selectWrapper.find(Menu).exists()).toBeTruthy();

  selectWrapper
    .find('div.react-select__dropdown-indicator')
    .simulate('mouseDown', { button: 0 });
  expect(selectWrapper.find(Menu).exists()).toBeFalsy();
});

test('Menu is controllable by menuIsOpen prop', () => {
  let selectWrapper = mount(<Select {...BASIC_PROPS} />);
  expect(selectWrapper.find(Menu).exists()).toBeFalsy();

  selectWrapper.setProps({ menuIsOpen: true });
  expect(selectWrapper.find(Menu).exists()).toBeTruthy();

  selectWrapper.setProps({ menuIsOpen: false });
  expect(selectWrapper.find(Menu).exists()).toBeFalsy();
});

cases(
  'Menu to open by default if menuIsOpen prop is true',
  ({ props = { ...BASIC_PROPS, menuIsOpen: true } }) => {
    let selectWrapper = mount(<Select {...props} />);
    expect(selectWrapper.find(Menu).exists()).toBeTruthy();
    selectWrapper
      .find('div.react-select__dropdown-indicator')
      .simulate('mouseDown', { button: 0 });
    // menu is not closed
    expect(selectWrapper.find(Menu).exists()).toBeTruthy();
  },
  {
    'single select > should keep Menu open by default if true is passed for menuIsOpen prop': {},
    'multi select > should keep Menu open by default if true is passed for menuIsOpen prop': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
        menuIsOpen: true,
      },
    },
  }
);

test('multi select > selecting multiple values', () => {
  let selectWrapper = mount(<Select {...BASIC_PROPS} isMulti />);
  // Open Menu
  selectWrapper
    .find('div.react-select__dropdown-indicator')
    .simulate('mouseDown', { button: 0 });
  selectWrapper.find(Menu).simulate('keyDown', { keyCode: 13, key: 'Enter' });
  expect(selectWrapper.find(Control).text()).toBe('0');

  selectWrapper
    .find('div.react-select__dropdown-indicator')
    .simulate('mouseDown', { button: 0 });
  selectWrapper.find(Menu).simulate('keyDown', { keyCode: 13, key: 'Enter' });
  expect(selectWrapper.find(Control).text()).toBe('01');
});

test('defaultInputValue prop > should update the inputValue on change of input if defaultInputValue prop is provided', () => {
  const props = { ...BASIC_PROPS, defaultInputValue: '0' };
  let selectWrapper = mount(<Select {...props} />);
  expect(selectWrapper.find('Control input').props().value).toBe('0');
  let input = selectWrapper.find('Control input').getDOMNode();
  // Thit is to set the event.currentTarget.value
  // Enzyme issue : https://github.com/airbnb/enzyme/issues/218
  input.value = 'A';
  selectWrapper
    .find('Control input')
    .simulate('change', { keyCode: 65, Key: 'A' });
  expect(selectWrapper.find('Control input').props().value).toBe('A');
});

test('inputValue prop > should not update the inputValue when on change of input if inputValue prop is provided', () => {
  const props = { ...BASIC_PROPS, inputValue: '0' };
  let selectWrapper = mount(<Select {...props} />);
  let input = selectWrapper.find('Control input').getDOMNode();
  // Thit is to set the event.currentTarget.value
  // Enzyme issue : https://github.com/airbnb/enzyme/issues/218
  input.value = 'A';
  selectWrapper
    .find('Control input')
    .simulate('change', { keyCode: 65, Key: 'A' });
  expect(selectWrapper.find('Control input').props().value).toBe('0');
});

test('defaultValue prop > should update the value on selecting option', () => {
  const props = { ...BASIC_PROPS, defaultValue: [OPTIONS[0]] };
  let selectWrapper = mount(<Select {...props} menuIsOpen />);
  expect(selectWrapper.find('input[type="hidden"]').props().value).toBe('zero');
  selectWrapper
    .find('div.react-select__option')
    .at(1)
    .simulate('click');
  expect(selectWrapper.find('input[type="hidden"]').props().value).toBe('one');
});

test('value prop > should update the value on selecting option', () => {
  const props = { ...BASIC_PROPS, value: [OPTIONS[0]] };
  let selectWrapper = mount(<Select {...props} menuIsOpen />);
  expect(selectWrapper.find('input[type="hidden"]').props().value).toBe('zero');
  selectWrapper
    .find('div.react-select__option')
    .at(1)
    .simulate('click');
  expect(selectWrapper.find('input[type="hidden"]').props().value).toBe('zero');
});

cases(
  'Integration tests > selecting an option > mouse interaction',
  ({
    props = { ...BASIC_PROPS },
    event,
    selectOption,
    expectSelectedOption,
  }) => {
    let selectWrapper = mount(<Select {...props} />);
    let toSelectOption = selectWrapper
      .find('div.react-select__option')
      .findWhere(n => n.props().children === selectOption.label);
    toSelectOption.simulate(...event);
    expect(selectWrapper.find('input[type="hidden"]').props().value).toBe(
      expectSelectedOption
    );
  },
  {
    'single select > clicking on an option > should select the clicked option': {
      props: {
        ...BASIC_PROPS,
        menuIsOpen: true,
      },
      event: ['click', { button: 0 }],
      selectOption: OPTIONS[2],
      expectSelectedOption: 'two',
    },
    'multi select > clicking on an option > should select the clicked option': {
      props: {
        ...BASIC_PROPS,
        delimiter: ', ',
        isMulti: true,
        menuIsOpen: true,
      },
      event: ['click', { button: 0 }],
      selectOption: OPTIONS[2],
      expectSelectedOption: 'two',
    },
  }
);

cases(
  'Integration tests > selection an option > keyboard interaction',
  ({
    props = { ...BASIC_PROPS },
    eventsToSimulate,
    expectedSelectedOption,
  }) => {
    let selectWrapper = mount(<Select {...props} />);
    // open the menu
    selectWrapper
      .find('div.react-select__dropdown-indicator')
      .simulate('keyDown', { keyCode: 40, key: 'ArrowDown' });
    eventsToSimulate.map(eventToSimulate => {
      selectWrapper.find(Menu).simulate(...eventToSimulate);
    });
    selectWrapper.find(Menu).simulate('keyDown', { keyCode: 13, key: 'Enter' });
    expect(selectWrapper.find('input[type="hidden"]').props().value).toBe(
      expectedSelectedOption
    );
  },
  {
    'single select > open select and hit enter > should select first option': {
      eventsToSimulate: [],
      expectedSelectedOption: OPTIONS[0].value,
    },
    'single select > (open select -> 3 x ArrowDown -> Enter) > should select the forth option in the select': {
      eventsToSimulate: [
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
      ],
      expectedSelectedOption: OPTIONS[3].value,
    },
    'single select > (open select -> 2 x ArrowDown -> 2 x ArrowUp -> Enter) > should select the first option in the select': {
      eventsToSimulate: [
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
        ['keyDown', { keyCode: 38, key: 'ArrowUp' }],
        ['keyDown', { keyCode: 38, key: 'ArrowUp' }],
      ],
      expectedSelectedOption: OPTIONS[0].value,
    },
    'single select > (open select -> 1 x ArrowUp -> Enter) > should select the last option in the select': {
      eventsToSimulate: [['keyDown', { keyCode: 38, key: 'ArrowUp' }]],
      expectedSelectedOption: OPTIONS[OPTIONS.length - 1].value,
    },
    'single select > (open select -> 1 x PageDown -> Enter) > should select the first option on next page - default pageSize 5': {
      eventsToSimulate: [['keyDown', { keyCode: 34, key: 'PageDown' }]],
      expectedSelectedOption: OPTIONS[5].value,
    },
    'single select > (open select -> 1 x PageDown -> 1 x ArrowDown -> 1 x PageUp -> Enter) > should select the second option - default pageSize 5': {
      eventsToSimulate: [
        ['keyDown', { keyCode: 34, key: 'PageDown' }],
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
        ['keyDown', { keyCode: 33, key: 'PageUp' }],
      ],
      expectedSelectedOption: OPTIONS[1].value,
    },
    'single select > (open select -> End -> Enter) > should select the last option': {
      eventsToSimulate: [['keyDown', { keyCode: 35, key: 'End' }]],
      expectedSelectedOption: OPTIONS[OPTIONS.length - 1].value,
    },
    'single select > (open select -> 3 x PageDown -> Home -> Enter) > should select the last option': {
      eventsToSimulate: [
        ['keyDown', { keyCode: 34, key: 'PageDown' }],
        ['keyDown', { keyCode: 34, key: 'PageDown' }],
        ['keyDown', { keyCode: 34, key: 'PageDown' }],
        ['keyDown', { keyCode: 36, key: 'Home' }],
      ],
      expectedSelectedOption: OPTIONS[0].value,
    },
    'single select > cycle options > ( open select -> End -> ArrowDown -> Enter) > should select the first option': {
      eventsToSimulate: [
        ['keyDown', { keyCode: 35, key: 'End' }],
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
      ],
      expectedSelectedOption: OPTIONS[0].value,
    },
    'single select > cycle options > (open select -> ArrowUp -> Enter) > should select the last option': {
      eventsToSimulate: [['keyDown', { keyCode: 38, key: 'ArrowUp' }]],
      expectedSelectedOption: OPTIONS[OPTIONS.length - 1].value,
    },
    'multi select > open select and hit enter > should select first option': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
      eventsToSimulate: [],
      expectedSelectedOption: OPTIONS[0].value,
    },
    'multi select > (open select -> 3 x ArrowDown -> Enter) > should select the forth option in the select': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
      eventsToSimulate: [
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
      ],
      expectedSelectedOption: OPTIONS[3].value,
    },
    'multi select > (open select -> 2 x ArrowDown -> 2 x ArrowUp -> Enter) > should select the first option in the select': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
      eventsToSimulate: [
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
        ['keyDown', { keyCode: 38, key: 'ArrowUp' }],
        ['keyDown', { keyCode: 38, key: 'ArrowUp' }],
      ],
      expectedSelectedOption: OPTIONS[0].value,
    },
    'multi select > (open select -> 1 x ArrowUp -> Enter) > should select the last option in the select': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
      eventsToSimulate: [['keyDown', { keyCode: 38, key: 'ArrowUp' }]],
      expectedSelectedOption: OPTIONS[OPTIONS.length - 1].value,
    },
    'multi select > (open select -> 1 x PageDown -> Enter) > should select the first option on next page - default pageSize 5': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
      eventsToSimulate: [['keyDown', { keyCode: 34, key: 'PageDown' }]],
      expectedSelectedOption: OPTIONS[5].value,
    },
    'multi select > (open select -> 1 x PageDown -> 1 x ArrowDown -> 1 x PageUp -> Enter) > should select the second option - default pageSize 5': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
      eventsToSimulate: [
        ['keyDown', { keyCode: 34, key: 'PageDown' }],
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
        ['keyDown', { keyCode: 33, key: 'PageUp' }],
      ],
      expectedSelectedOption: OPTIONS[1].value,
    },
    'multi select > (open select -> End -> Enter) > should select the last option': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
      eventsToSimulate: [['keyDown', { keyCode: 35, key: 'End' }]],
      expectedSelectedOption: OPTIONS[OPTIONS.length - 1].value,
    },
    'multi select > (open select -> 3 x PageDown -> Home -> Enter) > should select the last option': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
      eventsToSimulate: [
        ['keyDown', { keyCode: 34, key: 'PageDown' }],
        ['keyDown', { keyCode: 34, key: 'PageDown' }],
        ['keyDown', { keyCode: 34, key: 'PageDown' }],
        ['keyDown', { keyCode: 36, key: 'Home' }],
      ],
      expectedSelectedOption: OPTIONS[0].value,
    },
    'multi select > cycle options > ( open select -> End -> ArrowDown -> Enter) > should select the first option': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
      eventsToSimulate: [
        ['keyDown', { keyCode: 35, key: 'End' }],
        ['keyDown', { keyCode: 40, key: 'ArrowDown' }],
      ],
      expectedSelectedOption: OPTIONS[0].value,
    },
    'multi select > cycle options > (open select -> ArrowUp -> Enter) > should select the last option': {
      props: {
        ...BASIC_PROPS,
        isMulti: true,
      },
      eventsToSimulate: [['keyDown', { keyCode: 38, key: 'ArrowUp' }]],
      expectedSelectedOption: OPTIONS[OPTIONS.length - 1].value,
    },
  }
);

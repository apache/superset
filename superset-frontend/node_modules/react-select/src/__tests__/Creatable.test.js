import React from 'react';
import { shallow, mount } from 'enzyme';
import toJson from 'enzyme-to-json';
import cases from 'jest-in-case';

import Creatable from '../Creatable';
import { OPTIONS } from './constants';
import { components } from '../components';
const { Menu, NoOptionsMessage } = components;

test('defaults - snapshot', () => {
  const tree = shallow(<Creatable />);
  expect(toJson(tree)).toMatchSnapshot();
});

cases('filtered option is an exact match for an existing option',
  ({ props = { options: OPTIONS } }) => {
    const creatableSelectWrapper = mount(<Creatable menuIsOpen {...props} />);
    creatableSelectWrapper.setProps({ inputValue: 'one' });
    expect(creatableSelectWrapper.find(Menu).text()).not.toEqual(
      expect.stringContaining('create')
    );
  },
  {
    'single select > should not show "create..." prompt"': {},
    'multi select > should not show "create..." prompt"': {
      props: {
        isMulti: true,
        options: OPTIONS,
      },
    },
  }
);

cases('filterOptions returns invalid value ( null )',
  ({ props = { option: OPTIONS } }) => {
    let filterOptionSpy = jest.fn().mockReturnValue(null);
    const creatableSelectWrapper = mount(
      <Creatable filterOption={filterOptionSpy} menuIsOpen {...props} />
    );
    creatableSelectWrapper.setProps({ inputValue: 'one' });
    expect(creatableSelectWrapper.find(NoOptionsMessage).exists()).toBeTruthy();
    expect(creatableSelectWrapper.find(Menu).text()).not.toEqual(
      expect.stringContaining('create')
    );
  },
  {
    'single select > should not show "create..." prompt"': {},
    'multi select > should not show "create..." prompt"': {
      props: {
        isMulti: true,
        option: OPTIONS,
      },
    },
  }
);

cases('inputValue does not match any option after filter',
  ({ props = { options: OPTIONS } }) => {
    const creatableSelectWrapper = mount(<Creatable menuIsOpen {...props} />);
    creatableSelectWrapper.setProps({ inputValue: 'option not is list' });
    expect(creatableSelectWrapper.find(Menu).text()).toBe(
      'Create "option not is list"'
    );
  },
  {
    'single select > should show a placeholder "create..." prompt': {},
    'multi select > should show a placeholder "create..." prompt': {
      props: {
        isMulti: true,
        options: OPTIONS,
      },
    },
  }
);

cases('isValidNewOption() prop',
  ({ props = { options: OPTIONS } }) => {
    let isValidNewOption = jest.fn(options => options === 'new Option');
    const creatableSelectWrapper = mount(
      <Creatable menuIsOpen {...props} isValidNewOption={isValidNewOption} />
    );

    creatableSelectWrapper.setProps({ inputValue: 'new Option' });
    expect(creatableSelectWrapper.find(Menu).text()).toEqual(
      expect.stringContaining('Create "new Option"')
    );
    expect(creatableSelectWrapper.find(NoOptionsMessage).exists()).toBeFalsy();

    creatableSelectWrapper.setProps({ inputValue: 'invalid new Option' });
    expect(creatableSelectWrapper.find(Menu).text()).not.toEqual(
      expect.stringContaining('Create "invalid new Option"')
    );
    expect(creatableSelectWrapper.find(NoOptionsMessage).exists()).toBeTruthy();
  },
  {
    'single select > should show "create..." prompt only if isValidNewOption returns thruthy value': {},
    'multi select > should show "create..." prompt only if isValidNewOption returns thruthy value': {
      props: {
        isMulti: true,
        options: OPTIONS,
      },
    },
  }
);

cases('close by hitting escape with search text present',
  ({ props = { options: OPTIONS } }) => {
    const creatableSelectWrapper = mount(<Creatable menuIsOpen {...props} />);
    creatableSelectWrapper.setState({ inputValue: 'new Option' });
    creatableSelectWrapper.update();
    creatableSelectWrapper.simulate('keyDown', { keyCode: 27, key: 'Escape' });
    creatableSelectWrapper.update();
    expect(creatableSelectWrapper.state('inputValue')).toBe('');
  },
  {
    'single select > should remove the search text': {
    },
    'multi select > should remove the search text': {
      props: {
        isMulti: true,
        options: OPTIONS,
      },
    },
  }
);

test('should remove the new option after closing on blur', () => {
  const creatableSelectWrapper = mount(
    <Creatable menuIsOpen options={OPTIONS} />
  );
  creatableSelectWrapper.setState({ inputValue: 'new Option' });
  creatableSelectWrapper.find('Control input').simulate('blur');
  expect(creatableSelectWrapper.state('inputValue')).toBe('');
});

cases('getNewOptionData() prop',
  ({ props = { options: OPTIONS } }) => {
    let getNewOptionDataSpy = jest.fn(label => ({
      label: `custom text ${label}`,
      value: label,
    }));
    const creatableSelectWrapper = mount(
      <Creatable menuIsOpen {...props} getNewOptionData={getNewOptionDataSpy} />
    );
    creatableSelectWrapper.setState({ inputValue: 'new Option' });
    expect(creatableSelectWrapper.find(Menu).text()).toEqual(
      expect.stringContaining('custom text new Option')
    );
  },
  {
    'single select > should create option as per label returned from getNewOptionData': {
    },
    'multi select > should create option as per label returned from getNewOptionData': {
      props: {
        isMulti: true,
        options: OPTIONS,
      },
    },
  }
);

cases('formatCreateLabel() prop',
  ({ props = { options: OPTIONS } }) => {
    let formatCreateLabelSpy = jest.fn(label => `custom label "${label}"`);
    const creatableSelectWrapper = mount(
      <Creatable
        menuIsOpen
        {...props}
        formatCreateLabel={formatCreateLabelSpy}
      />
    );
    creatableSelectWrapper.setState({ inputValue: 'new Option' });
    expect(creatableSelectWrapper.find(Menu).text()).toEqual(
      expect.stringContaining('custom label "new Option"')
    );
  },
  {
    'single select > should show label of custom option as per text returned from formatCreateLabel': {},
    'multi select > should show label of custom option as per text returned from formatCreateLabel': {
      props: {
        isMulti: true,
        options: OPTIONS,
      },
    },
  }
);

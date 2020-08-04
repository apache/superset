import React from 'react';
import { mount } from 'enzyme';
import toJson from 'enzyme-to-json';

import AsyncCreatable from '../AsyncCreatable';
import Select from '../Select';
import { components } from '../components';
import { OPTIONS } from './constants';
const { Menu, Option } = components;

test('defaults - snapshot', () => {
  const tree = mount(<AsyncCreatable />);
  expect(toJson(tree)).toMatchSnapshot();
});

test('creates an inner Select', () => {
  const asyncCreatableWrapper = mount(
    <AsyncCreatable className="react-select" classNamePrefix="react-select"/>
  );
  expect(asyncCreatableWrapper.find(Select).exists()).toBeTruthy();
});

test('render decorated select with props passed', () => {
  const asyncCreatableWrapper = mount(<AsyncCreatable className="foo" classNamePrefix="foo" />);
  expect(asyncCreatableWrapper.find(Select).props().className).toBe('foo');
});

test('to show the create option in menu', () => {
  let asyncCreatableWrapper = mount(
    <AsyncCreatable className="react-select" classNamePrefix="react-select"/>
  );
  let inputValueWrapper = asyncCreatableWrapper.find(
    'div.react-select__input input'
  );
  asyncCreatableWrapper.setProps({ inputValue: 'a' });
  inputValueWrapper.simulate('change', { currentTarget: { value: 'a' } });
  expect(
    asyncCreatableWrapper
      .find(Option)
      .last()
      .text()
  ).toBe('Create "a"');
});

test('to show loading and then create option in menu', () => {
  jest.useFakeTimers();
  let loadOptionsSpy = jest.fn((inputValue, callback) =>
    setTimeout(() => callback(OPTIONS), 200)
  );
  let asyncCreatableWrapper = mount(
    <AsyncCreatable className="react-select" classNamePrefix="react-select" loadOptions={loadOptionsSpy} />
  );
  let inputValueWrapper = asyncCreatableWrapper.find(
    'div.react-select__input input'
  );
  asyncCreatableWrapper.setProps({ inputValue: 'a' });
  inputValueWrapper.simulate('change', { currentTarget: { value: 'a' } });

  // to show a loading message while loading options
  expect(asyncCreatableWrapper.find(Menu).text()).toBe('Loading...');
  jest.runAllTimers();
  asyncCreatableWrapper.update();

  // show create options once options are loaded
  expect(
    asyncCreatableWrapper
      .find(Option)
      .last()
      .text()
  ).toBe('Create "a"');
});

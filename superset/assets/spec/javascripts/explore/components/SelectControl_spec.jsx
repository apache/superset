/* eslint-disable no-unused-expressions */
import React from 'react';
import Select, { Creatable } from 'react-select';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import SelectControl from '../../../../javascripts/explore/components/controls/SelectControl';

const defaultProps = {
  choices: [['1 year ago', '1 year ago'], ['today', 'today']],
  name: 'row_limit',
  label: 'Row Limit',
  onChange: sinon.spy(),
};

const options = [
  { value: '1 year ago', label: '1 year ago' },
  { value: 'today', label: 'today' },
];

describe('SelectControl', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<SelectControl {...defaultProps} />);
  });

  it('renders a Select', () => {
    expect(wrapper.find(Select)).to.have.lengthOf(1);
  });

  it('calls onChange when toggled', () => {
    const select = wrapper.find(Select);
    select.simulate('change', { value: 50 });
    expect(defaultProps.onChange.calledWith(50)).to.be.true;
  });

  it('renders a Creatable for freeform', () => {
    wrapper = shallow(<SelectControl {...defaultProps} freeForm />);
    expect(wrapper.find(Creatable)).to.have.lengthOf(1);
  });

  describe('getOptions', () => {
    it('returns the correct options', () => {
      expect(wrapper.instance().getOptions(defaultProps)).to.deep.equal(options);
    });

    it('returns the correct options when freeform is set to true', () => {
      const freeFormProps = Object.assign(defaultProps, {
        choices: [],
        freeForm: true,
        value: ['one', 'two'],
      });
      const newOptions = [
        { value: 'one', label: 'one' },
        { value: 'two', label: 'two' },
      ];
      expect(wrapper.instance().getOptions(freeFormProps)).to.deep.equal(newOptions);
    });
  });

  describe('componentWillReceiveProps', () => {
    it('sets state.options if props.choices has changed', () => {
      const updatedOptions = [
        { value: 'three', label: 'three' },
        { value: 'four', label: 'four' },
      ];
      const newProps = {
        choices: [['three', 'three'], ['four', 'four']],
        name: 'name',
        freeForm: false,
        value: null,
      };
      wrapper.setProps(newProps);
      expect(wrapper.state().options).to.deep.equal(updatedOptions);
    });
  });
});

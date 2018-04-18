/* eslint-disable no-unused-expressions */
import React from 'react';
import Select, { Creatable } from 'react-select';
import VirtualizedSelect from 'react-virtualized-select';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import OnPasteSelect from '../../../../src/components/OnPasteSelect';
import VirtualizedRendererWrap from '../../../../src/components/VirtualizedRendererWrap';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';

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

  it('renders an OnPasteSelect', () => {
    expect(wrapper.find(OnPasteSelect)).to.have.lengthOf(1);
  });

  it('calls onChange when toggled', () => {
    const select = wrapper.find(OnPasteSelect);
    select.simulate('change', { value: 50 });
    expect(defaultProps.onChange.calledWith(50)).to.be.true;
  });

  it('passes VirtualizedSelect as selectWrap', () => {
    const select = wrapper.find(OnPasteSelect);
    expect(select.props().selectWrap).to.equal(VirtualizedSelect);
  });

  it('passes Creatable as selectComponent when freeForm=true', () => {
    wrapper = shallow(<SelectControl {...defaultProps} freeForm />);
    const select = wrapper.find(OnPasteSelect);
    expect(select.props().selectComponent).to.equal(Creatable);
  });

  it('passes Select as selectComponent when freeForm=false', () => {
    const select = wrapper.find(OnPasteSelect);
    expect(select.props().selectComponent).to.equal(Select);
  });

  it('wraps optionRenderer in a VirtualizedRendererWrap', () => {
    const select = wrapper.find(OnPasteSelect);
    const defaultOptionRenderer = SelectControl.defaultProps.optionRenderer;
    const wrappedRenderer = VirtualizedRendererWrap(defaultOptionRenderer);
    expect(select.props().optionRenderer).to.be.a('Function');
    // different instances of wrapper with same inner renderer are unequal
    expect(select.props().optionRenderer.name).to.equal(wrappedRenderer.name);
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

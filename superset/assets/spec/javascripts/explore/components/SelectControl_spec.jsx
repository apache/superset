/* eslint-disable no-unused-expressions */
import React from 'react';
import Select, { Creatable } from 'react-select';
import VirtualizedSelect from 'react-virtualized-select';
import sinon from 'sinon';
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
    expect(wrapper.find(OnPasteSelect)).toHaveLength(1);
  });

  it('calls onChange when toggled', () => {
    const select = wrapper.find(OnPasteSelect);
    select.simulate('change', { value: 50 });
    expect(defaultProps.onChange.calledWith(50)).toBe(true);
  });

  it('passes VirtualizedSelect as selectWrap', () => {
    const select = wrapper.find(OnPasteSelect);
    expect(select.props().selectWrap).toBe(VirtualizedSelect);
  });

  it('passes Creatable as selectComponent when freeForm=true', () => {
    wrapper = shallow(<SelectControl {...defaultProps} freeForm />);
    const select = wrapper.find(OnPasteSelect);
    expect(select.props().selectComponent).toBe(Creatable);
  });

  it('passes Select as selectComponent when freeForm=false', () => {
    const select = wrapper.find(OnPasteSelect);
    expect(select.props().selectComponent).toBe(Select);
  });

  it('wraps optionRenderer in a VirtualizedRendererWrap', () => {
    const select = wrapper.find(OnPasteSelect);
    const defaultOptionRenderer = SelectControl.defaultProps.optionRenderer;
    const wrappedRenderer = VirtualizedRendererWrap(defaultOptionRenderer);
    expect(typeof select.props().optionRenderer).toBe('function');
    // different instances of wrapper with same inner renderer are unequal
    expect(select.props().optionRenderer.name).toBe(wrappedRenderer.name);
  });

  describe('getOptions', () => {
    it('returns the correct options', () => {
      expect(wrapper.instance().getOptions(defaultProps)).toEqual(options);
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
      expect(wrapper.instance().getOptions(freeFormProps)).toEqual(newOptions);
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
      expect(wrapper.state().options).toEqual(updatedOptions);
    });
  });
});

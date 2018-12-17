/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';
import VirtualizedSelect from 'react-virtualized-select';
import Select, { Creatable } from 'react-select';

import OnPasteSelect from '../../../src/components/OnPasteSelect';

const defaultProps = {
  onChange: sinon.spy(),
  multi: true,
  isValidNewOption: sinon.spy(s => !!s.label),
  value: [],
  options: [
    { value: 'United States', label: 'United States' },
    { value: 'China', label: 'China' },
    { value: 'India', label: 'India' },
    { value: 'Canada', label: 'Canada' },
    { value: 'Russian Federation', label: 'Russian Federation' },
    { value: 'Japan', label: 'Japan' },
    { value: 'Mexico', label: 'Mexico' },
  ],
};

const defaultEvt = {
  preventDefault: sinon.spy(),
  clipboardData: {
    getData: sinon.spy(() => ' United States, China  , India, Canada, '),
  },
};

describe('OnPasteSelect', () => {
  let wrapper;
  let props;
  let evt;
  let expected;
  beforeEach(() => {
    props = Object.assign({}, defaultProps);
    wrapper = shallow(<OnPasteSelect {...props} />);
    evt = Object.assign({}, defaultEvt);
  });

  it('renders the supplied selectWrap component', () => {
    const select = wrapper.find(Select);
    expect(select).toHaveLength(1);
  });

  it('renders custom selectWrap components', () => {
    props.selectWrap = Creatable;
    wrapper = shallow(<OnPasteSelect {...props} />);
    expect(wrapper.find(Creatable)).toHaveLength(1);
    props.selectWrap = VirtualizedSelect;
    wrapper = shallow(<OnPasteSelect {...props} />);
    expect(wrapper.find(VirtualizedSelect)).toHaveLength(1);
  });

  describe('onPaste', () => {
    it('calls onChange with pasted values', () => {
      wrapper.instance().onPaste(evt);
      expected = props.options.slice(0, 4);
      expect(props.onChange.calledWith(expected)).toBe(true);
      expect(evt.preventDefault.called).toBe(true);
      expect(props.isValidNewOption.callCount).toBe(5);
    });

    it('calls onChange without any duplicate values and adds new values', () => {
      evt.clipboardData.getData = sinon.spy(() =>
        'China, China, China, China, Mexico, Mexico, Chi na, Mexico, ',
      );
      expected = [
        props.options[1],
        props.options[6],
        { label: 'Chi na', value: 'Chi na' },
      ];
      wrapper.instance().onPaste(evt);
      expect(props.onChange.calledWith(expected)).toBe(true);
      expect(evt.preventDefault.called).toBe(true);
      expect(props.isValidNewOption.callCount).toBe(9);
      expect(props.options[0].value).toBe(expected[2].value);
      props.options.splice(0, 1);
    });

    it('calls onChange with currently selected values and new values', () => {
      props.value = ['United States', 'Canada', 'Mexico'];
      evt.clipboardData.getData = sinon.spy(() =>
        'United States, Canada, Japan, India',
      );
      wrapper = shallow(<OnPasteSelect {...props} />);
      expected = [
        props.options[0],
        props.options[3],
        props.options[6],
        props.options[5],
        props.options[2],
      ];
      wrapper.instance().onPaste(evt);
      expect(props.onChange.calledWith(expected)).toBe(true);
      expect(evt.preventDefault.called).toBe(true);
      expect(props.isValidNewOption.callCount).toBe(11);
    });
  });
});

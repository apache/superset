/* eslint-disable no-unused-expressions */
import React from 'react';
import Select from 'react-select';
import { Button } from 'react-bootstrap';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import Filter from '../../../../src/explore/components/controls/Filter';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';

const defaultProps = {
  changeFilter: sinon.spy(),
  removeFilter: () => {},
  filter: {
    col: null,
    op: 'in',
    value: ['val'],
  },
  datasource: {
    id: 1,
    type: 'qtable',
    filter_select: false,
    filterable_cols: ['col1', 'col2'],
    metrics_combo: [
      ['m1', 'v1'],
      ['m2', 'v2'],
    ],
  },
};

describe('Filter', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<Filter {...defaultProps} />);
  });

  it('renders Filters', () => {
    expect(
      React.isValidElement(<Filter {...defaultProps} />),
    ).to.equal(true);
  });

  it('renders two selects, one button and one input', () => {
    expect(wrapper.find(Select)).to.have.lengthOf(2);
    expect(wrapper.find(Button)).to.have.lengthOf(1);
    expect(wrapper.find(SelectControl)).to.have.lengthOf(1);
    expect(wrapper.find('#select-op').prop('options')).to.have.lengthOf(10);
  });

  it('renders five op choices for table datasource', () => {
    const props = Object.assign({}, defaultProps);
    props.datasource = {
      id: 1,
      type: 'druid',
      filter_select: false,
      filterable_cols: ['country_name'],
    };
    const druidWrapper = shallow(<Filter {...props} />);
    expect(druidWrapper.find('#select-op').prop('options')).to.have.lengthOf(11);
  });

  it('renders six op choices for having filter', () => {
    const props = Object.assign({}, defaultProps);
    props.having = true;
    const havingWrapper = shallow(<Filter {...props} />);
    expect(havingWrapper.find('#select-op').prop('options')).to.have.lengthOf(6);
  });

  it('calls changeFilter when select is changed', () => {
    const selectCol = wrapper.find('#select-col');
    selectCol.simulate('change', { value: 'col' });
    const selectOp = wrapper.find('#select-op');
    selectOp.simulate('change', { value: 'in' });
    const selectVal = wrapper.find(SelectControl);
    selectVal.simulate('change', { value: 'x' });
    expect(defaultProps.changeFilter).to.have.property('callCount', 3);
  });

  it('renders input for regex filters', () => {
    const props = Object.assign({}, defaultProps);
    props.filter = {
      col: null,
      op: 'regex',
      value: 'val',
    };
    const regexWrapper = shallow(<Filter {...props} />);
    expect(regexWrapper.find('input')).to.have.lengthOf(1);
  });

  it('renders `input` for text filters', () => {
    const props = Object.assign({}, defaultProps);
    ['>=', '>', '<=', '<'].forEach((op) => {
      props.filter = {
        col: 'col1',
        op,
        value: 'val',
      };
      wrapper = shallow(<Filter {...props} />);
      expect(wrapper.find('input')).to.have.lengthOf(1);
    });
  });

  it('replaces null filter values with empty string in `input`', () => {
    const props = Object.assign({}, defaultProps);
    props.filter = {
      col: 'col1',
      op: '>=',
      value: null,
    };
    wrapper = shallow(<Filter {...props} />);
    expect(wrapper.find('input').props().value).to.equal('');
  });
});

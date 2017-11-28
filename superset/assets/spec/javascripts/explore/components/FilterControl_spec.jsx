/* eslint-disable no-unused-expressions */
import React from 'react';
import { Button } from 'react-bootstrap';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import FilterControl from '../../../../javascripts/explore/components/controls/FilterControl';
import Filter from '../../../../javascripts/explore/components/controls/Filter';

const $ = window.$ = require('jquery');

const defaultProps = {
  name: 'not_having_filters',
  onChange: sinon.spy(),
  value: [
    {
      col: 'col1',
      op: 'in',
      val: ['a', 'b', 'd'],
    },
    {
      col: 'col2',
      op: '==',
      val: 'Z',
    },
  ],
  datasource: {
    id: 1,
    type: 'qtable',
    filter_select: true,
    filterable_cols: [['col1', 'col2']],
    metrics_combo: [
      ['m1', 'v1'],
      ['m2', 'v2'],
    ],
  },
};

describe('FilterControl', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<FilterControl {...defaultProps} />);
    wrapper.setState({
      filters: [
        {
          valuesLoading: false,
          valueChoices: ['a', 'b', 'c', 'd', 'e', 'f'],
        },
        {
          valuesLoading: false,
          valueChoices: ['X', 'Y', 'Z'],
        },
        // Need a duplicate since onChange calls are not changing props
        {
          valuesLoading: false,
          valueChoices: ['X', 'Y', 'Z'],
        },
      ],
    });
  });

  it('renders Filters', () => {
    expect(
      React.isValidElement(<FilterControl {...defaultProps} />),
    ).to.equal(true);
  });

  it('renders one button and two filters', () => {
    expect(wrapper.find(Filter)).to.have.lengthOf(2);
    expect(wrapper.find(Button)).to.have.lengthOf(1);
  });

  it('adds filter when clicking Add Filter', () => {
    const addButton = wrapper.find('#add-button');
    expect(addButton).to.have.lengthOf(1);
    addButton.simulate('click');
    expect(defaultProps.onChange).to.have.property('callCount', 1);
    expect(defaultProps.onChange.getCall(0).args[0]).to.deep.equal([
      {
        col: 'col1',
        op: 'in',
        val: ['a', 'b', 'd'],
      },
      {
        col: 'col2',
        op: '==',
        val: 'Z',
      },
      {
        col: 'col1',
        op: 'in',
        val: [],
      },
    ]);
  });

  it('removes a the second filter when its delete button is clicked', () => {
    expect(wrapper.find(Filter)).to.have.lengthOf(2);
    wrapper.instance().removeFilter(1);
    expect(defaultProps.onChange).to.have.property('callCount', 2);
    expect(defaultProps.onChange.getCall(1).args[0]).to.deep.equal([
      {
        col: 'col1',
        op: 'in',
        val: ['a', 'b', 'd'],
      },
    ]);
  });

  before(() => {
    sinon.stub($, 'ajax');
  });

  after(() => {
    $.ajax.restore();
  });

  it('makes a GET request to retrieve value choices', () => {
    wrapper.instance().fetchFilterValues(0, 'col1');
    expect($.ajax.getCall(0).args[0].type).to.deep.equal('GET');
    expect($.ajax.getCall(0).args[0].url).to.deep.equal('/superset/filter/qtable/1/col1/');
  });

  it('changes filter values when one is removed', () => {
    wrapper.instance().changeFilter(0, 'val', ['a', 'b']);
    expect(defaultProps.onChange).to.have.property('callCount', 3);
    expect(defaultProps.onChange.getCall(2).args[0]).to.deep.equal([
      {
        col: 'col1',
        op: 'in',
        val: ['a', 'b'],
      },
      {
        col: 'col2',
        op: '==',
        val: 'Z',
      },
    ]);
  });

  it('changes filter values when one is added', () => {
    wrapper.instance().changeFilter(0, 'val', ['a', 'b', 'd', 'e']);
    expect(defaultProps.onChange).to.have.property('callCount', 4);
    expect(defaultProps.onChange.getCall(3).args[0]).to.deep.equal([
      {
        col: 'col1',
        op: 'in',
        val: ['a', 'b', 'd', 'e'],
      },
      {
        col: 'col2',
        op: '==',
        val: 'Z',
      },
    ]);
  });

  it('changes op and transforms values', () => {
    wrapper.instance().changeFilter(0, ['val', 'op'], ['a', '==']);
    wrapper.instance().changeFilter(1, ['val', 'op'], [['Z'], 'in']);
    expect(defaultProps.onChange).to.have.property('callCount', 6);
    expect(defaultProps.onChange.getCall(4).args[0]).to.deep.equal([
      {
        col: 'col1',
        op: '==',
        val: 'a',
      },
      {
        col: 'col2',
        op: '==',
        val: 'Z',
      },
    ]);
    expect(defaultProps.onChange.getCall(5).args[0]).to.deep.equal([
      {
        col: 'col1',
        op: 'in',
        val: ['a', 'b', 'd'],
      },
      {
        col: 'col2',
        op: 'in',
        val: ['Z'],
      },
    ]);
  });

  it('changes column and clears invalid values', () => {
    wrapper.instance().changeFilter(0, 'col', 'col2');
    expect(defaultProps.onChange).to.have.property('callCount', 7);
    expect(defaultProps.onChange.getCall(6).args[0]).to.deep.equal([
      {
        col: 'col2',
        op: 'in',
        val: [],
      },
      {
        col: 'col2',
        op: '==',
        val: 'Z',
      },
    ]);
    wrapper.instance().changeFilter(1, 'col', 'col1');
    expect(defaultProps.onChange).to.have.property('callCount', 8);
    expect(defaultProps.onChange.getCall(7).args[0]).to.deep.equal([
      {
        col: 'col1',
        op: 'in',
        val: ['a', 'b', 'd'],
      },
      {
        col: 'col1',
        op: '==',
        val: '',
      },
    ]);
  });

  it('tracks an active filter select ajax request', () => {
    const spyReq = sinon.spy();
    $.ajax.reset();
    $.ajax.onFirstCall().returns(spyReq);
    wrapper.instance().fetchFilterValues(0, 'col1');
    expect(wrapper.state().activeRequest).to.equal(spyReq);
    // Sets active to null after success
    $.ajax.getCall(0).args[0].success('choices');
    expect(wrapper.state().filters[0].valuesLoading).to.equal(false);
    expect(wrapper.state().filters[0].valueChoices).to.equal('choices');
    expect(wrapper.state().activeRequest).to.equal(null);
  });

  it('cancels active request if another is submitted', () => {
    const spyReq = sinon.spy();
    spyReq.abort = sinon.spy();
    $.ajax.reset();
    $.ajax.onFirstCall().returns(spyReq);
    wrapper.instance().fetchFilterValues(0, 'col1');
    expect(wrapper.state().activeRequest).to.equal(spyReq);
    const spyReq1 = sinon.spy();
    $.ajax.onSecondCall().returns(spyReq1);
    wrapper.instance().fetchFilterValues(1, 'col2');
    expect(spyReq.abort.called).to.equal(true);
    expect(wrapper.state().activeRequest).to.equal(spyReq1);
  });
});

import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import { Table, Thead, Td, Th, Tr } from 'reactable';

import AlteredSliceTag from '../../../javascripts/components/AlteredSliceTag';
import ModalTrigger from '../../../javascripts/components/ModalTrigger';
import TooltipWrapper from '../../../javascripts/components/TooltipWrapper';

const defaultProps = {
  origFormData: {
    filters: [{ col: 'a', op: '==', val: 'hello' }],
    y_axis_bounds: [10, 20],
    column_collection: [{ 1: 'a', b: ['6', 'g'] }],
    bool: false,
    alpha: undefined,
    gucci: [1, 2, 3, 4],
    never: 5,
    ever: { a: 'b', c: 'd' },
  },
  currentFormData: {
    filters: [{ col: 'b', op: 'in', val: ['hello', 'my', 'name'] }],
    y_axis_bounds: [15, 16],
    column_collection: [{ 1: 'a', b: [9, '15'], t: 'gggg' }],
    bool: true,
    alpha: null,
    gucci: ['a', 'b', 'c', 'd'],
    never: 10,
    ever: { x: 'y', z: 'z' },
  },
};

const expectedDiffs = {
  filters: {
    before: [{ col: 'a', op: '==', val: 'hello' }],
    after: [{ col: 'b', op: 'in', val: ['hello', 'my', 'name'] }],
  },
  y_axis_bounds: {
    before: [10, 20],
    after: [15, 16],
  },
  column_collection: {
    before: [{ 1: 'a', b: ['6', 'g'] }],
    after: [{ 1: 'a', b: [9, '15'], t: 'gggg' }],
  },
  bool: {
    before: false,
    after: true,
  },
  gucci: {
    before: [1, 2, 3, 4],
    after: ['a', 'b', 'c', 'd'],
  },
  never: {
    before: 5,
    after: 10,
  },
  ever: {
    before: { a: 'b', c: 'd' },
    after: { x: 'y', z: 'z' },
  },
};

describe('AlteredSliceTag', () => {
  let wrapper;
  let props;

  beforeEach(() => {
    props = Object.assign({}, defaultProps);
    wrapper = shallow(<AlteredSliceTag {...props} />);
  });

  it('correctly determines form data differences', () => {
    const diffs = wrapper.instance().getDiffs(props);
    expect(diffs).to.deep.equal(expectedDiffs);
    expect(wrapper.instance().state.diffs).to.deep.equal(expectedDiffs);
    expect(wrapper.instance().state.hasDiffs).to.equal(true);
  });

  it('does not run when there are no differences', () => {
    props = {
      origFormData: props.origFormData,
      currentFormData: props.origFormData,
    };
    wrapper = shallow(<AlteredSliceTag {...props} />);
    expect(wrapper.instance().state.diffs).to.deep.equal({});
    expect(wrapper.instance().state.hasDiffs).to.equal(false);
    expect(wrapper.instance().render()).to.equal(null);
  });

  it('sets new diffs when receiving new props', () => {
    const newProps = {
      currentFormData: Object.assign({}, props.currentFormData),
      origFormData: Object.assign({}, props.origFormData),
    };
    newProps.currentFormData.beta = 10;
    wrapper = shallow(<AlteredSliceTag {...props} />);
    wrapper.instance().componentWillReceiveProps(newProps);
    const newDiffs = wrapper.instance().state.diffs;
    const expectedBeta = { before: undefined, after: 10 };
    expect(newDiffs.beta).to.deep.equal(expectedBeta);
  });

  it('does not set new state when props are the same', () => {
    const currentDiff = wrapper.instance().state.diffs;
    wrapper.instance().componentWillReceiveProps(props);
    // Check equal references
    expect(wrapper.instance().state.diffs).to.equal(currentDiff);
  });

  it('renders a ModalTrigger', () => {
    expect(wrapper.find(ModalTrigger)).to.have.lengthOf(1);
  });

  describe('renderTriggerNode', () => {
    it('renders a TooltipWrapper', () => {
      const triggerNode = shallow(<div>{wrapper.instance().renderTriggerNode()}</div>);
      expect(triggerNode.find(TooltipWrapper)).to.have.lengthOf(1);
    });
  });

  describe('renderModalBody', () => {
    it('renders a Table', () => {
      const modalBody = shallow(<div>{wrapper.instance().renderModalBody()}</div>);
      expect(modalBody.find(Table)).to.have.lengthOf(1);
    });

    it('renders a Thead', () => {
      const modalBody = shallow(<div>{wrapper.instance().renderModalBody()}</div>);
      expect(modalBody.find(Thead)).to.have.lengthOf(1);
    });

    it('renders Th', () => {
      const modalBody = shallow(<div>{wrapper.instance().renderModalBody()}</div>);
      const th = modalBody.find(Th);
      expect(th).to.have.lengthOf(3);
      ['control', 'before', 'after'].forEach((v, i) => {
        expect(th.get(i).props.column).to.equal(v);
      });
    });

    it('renders the correct number of Tr', () => {
      const modalBody = shallow(<div>{wrapper.instance().renderModalBody()}</div>);
      const tr = modalBody.find(Tr);
      expect(tr).to.have.lengthOf(7);
    });

    it('renders the correct number of Td', () => {
      const modalBody = shallow(<div>{wrapper.instance().renderModalBody()}</div>);
      const td = modalBody.find(Td);
      expect(td).to.have.lengthOf(21);
      ['control', 'before', 'after'].forEach((v, i) => {
        expect(td.get(i).props.column).to.equal(v);
      });
    });
  });

  describe('renderRows', () => {
    it('returns an array of rows with one Tr and three Td', () => {
      const rows = wrapper.instance().renderRows();
      expect(rows).to.have.lengthOf(7);
      const fakeRow = shallow(<div>{rows[0]}</div>);
      expect(fakeRow.find(Tr)).to.have.lengthOf(1);
      expect(fakeRow.find(Td)).to.have.lengthOf(3);
    });
  });

  describe('formatValue', () => {
    it('returns "N/A" for undefined values', () => {
      expect(wrapper.instance().formatValue(undefined, 'b')).to.equal('N/A');
    });

    it('returns "null" for null values', () => {
      expect(wrapper.instance().formatValue(null, 'b')).to.equal('null');
    });

    it('returns "Max" and "Min" for BoundsControl', () => {
      expect(wrapper.instance().formatValue([5, 6], 'y_axis_bounds')).to.equal(
        'Min: 5, Max: 6',
      );
    });

    it('returns stringified objects for CollectionControl', () => {
      const value = [{ 1: 2, alpha: 'bravo' }, { sent: 'imental', w0ke: 5 }];
      const expected = '{"1":2,"alpha":"bravo"}, {"sent":"imental","w0ke":5}';
      expect(wrapper.instance().formatValue(value, 'column_collection')).to.equal(expected);
    });

    it('returns boolean values as string', () => {
      expect(wrapper.instance().formatValue(true, 'b')).to.equal('true');
      expect(wrapper.instance().formatValue(false, 'b')).to.equal('false');
    });

    it('returns Array joined by commas', () => {
      const value = [5, 6, 7, 8, 'hello', 'goodbye'];
      const expected = '5, 6, 7, 8, hello, goodbye';
      expect(wrapper.instance().formatValue(value)).to.equal(expected);
    });

    it('stringifies objects', () => {
      const value = { 1: 2, alpha: 'bravo' };
      const expected = '{"1":2,"alpha":"bravo"}';
      expect(wrapper.instance().formatValue(value)).to.equal(expected);
    });

    it('does nothing to strings and numbers', () => {
      expect(wrapper.instance().formatValue(5)).to.equal(5);
      expect(wrapper.instance().formatValue('hello')).to.equal('hello');
    });

    it('returns "[]" for empty filters', () => {
      expect(wrapper.instance().formatValue([], 'filters')).to.equal('[]');
    });

    it('correctly formats filters with array values', () => {
      const filters = [
        { col: 'a', op: 'in', val: ['1', 'g', '7', 'ho'] },
        { col: 'b', op: 'not in', val: ['hu', 'ho', 'ha'] },
      ];
      const expected = 'a in [1, g, 7, ho], b not in [hu, ho, ha]';
      expect(wrapper.instance().formatValue(filters, 'filters')).to.equal(expected);
    });

    it('correctly formats filters with string values', () => {
      const filters = [
        { col: 'a', op: '==', val: 'gucci' },
        { col: 'b', op: 'LIKE', val: 'moshi moshi' },
      ];
      const expected = 'a == gucci, b LIKE moshi moshi';
      expect(wrapper.instance().formatValue(filters, 'filters')).to.equal(expected);
    });
  });
});

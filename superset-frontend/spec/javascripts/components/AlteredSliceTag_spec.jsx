/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import { shallow } from 'enzyme';
import { Table, Thead, Td, Th, Tr } from 'reactable-arc';
import { getChartControlPanelRegistry } from '@superset-ui/chart';

import AlteredSliceTag from 'src/components/AlteredSliceTag';
import ModalTrigger from 'src/components/ModalTrigger';
import TooltipWrapper from 'src/components/TooltipWrapper';

const defaultProps = {
  origFormData: {
    viz_type: 'altered_slice_tag_spec',
    adhoc_filters: [
      {
        clause: 'WHERE',
        comparator: 'hello',
        expressionType: 'SIMPLE',
        operator: '==',
        subject: 'a',
      },
    ],
    y_axis_bounds: [10, 20],
    column_collection: [{ 1: 'a', b: ['6', 'g'] }],
    bool: false,
    alpha: undefined,
    gucci: [1, 2, 3, 4],
    never: 5,
    ever: { a: 'b', c: 'd' },
  },
  currentFormData: {
    adhoc_filters: [
      {
        clause: 'WHERE',
        comparator: ['hello', 'my', 'name'],
        expressionType: 'SIMPLE',
        operator: 'in',
        subject: 'b',
      },
    ],
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
  adhoc_filters: {
    before: [
      {
        clause: 'WHERE',
        comparator: 'hello',
        expressionType: 'SIMPLE',
        operator: '==',
        subject: 'a',
      },
    ],
    after: [
      {
        clause: 'WHERE',
        comparator: ['hello', 'my', 'name'],
        expressionType: 'SIMPLE',
        operator: 'in',
        subject: 'b',
      },
    ],
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

const fakePluginControls = {
  controlPanelSections: [
    {
      label: 'Fake Control Panel Sections',
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'y_axis_bounds',
            config: {
              type: 'BoundsControl',
              label: 'Value bounds',
              default: [null, null],
              description: 'Value bounds for the y axis',
            },
          },
          {
            name: 'column_collection',
            config: {
              type: 'CollectionControl',
              label: 'Fake Collection Control',
            },
          },
          {
            name: 'adhoc_filters',
            config: {
              type: 'AdhocFilterControl',
              label: 'Fake Filters',
              default: null,
            },
          },
        ],
      ],
    },
  ],
};

describe('AlteredSliceTag', () => {
  let wrapper;
  let props;

  beforeEach(() => {
    getChartControlPanelRegistry().registerValue(
      'altered_slice_tag_spec',
      fakePluginControls,
    );
    props = { ...defaultProps };
    wrapper = shallow(<AlteredSliceTag {...props} />);
  });

  it('correctly determines form data differences', () => {
    const diffs = wrapper.instance().getDiffs(props);
    expect(diffs).toEqual(expectedDiffs);
    expect(wrapper.instance().state.diffs).toEqual(expectedDiffs);
    expect(wrapper.instance().state.hasDiffs).toBe(true);
  });

  it('does not run when there are no differences', () => {
    props = {
      origFormData: props.origFormData,
      currentFormData: props.origFormData,
    };
    wrapper = shallow(<AlteredSliceTag {...props} />);
    expect(wrapper.instance().state.diffs).toEqual({});
    expect(wrapper.instance().state.hasDiffs).toBe(false);
    expect(wrapper.instance().render()).toBeNull();
  });

  it('sets new diffs when receiving new props', () => {
    const newProps = {
      currentFormData: { ...props.currentFormData },
      origFormData: { ...props.origFormData },
    };
    newProps.currentFormData.beta = 10;
    wrapper = shallow(<AlteredSliceTag {...props} />);
    wrapper.instance().UNSAFE_componentWillReceiveProps(newProps);
    const newDiffs = wrapper.instance().state.diffs;
    const expectedBeta = { before: undefined, after: 10 };
    expect(newDiffs.beta).toEqual(expectedBeta);
  });

  it('does not set new state when props are the same', () => {
    const currentDiff = wrapper.instance().state.diffs;
    wrapper.instance().UNSAFE_componentWillReceiveProps(props);
    // Check equal references
    expect(wrapper.instance().state.diffs).toBe(currentDiff);
  });

  it('renders a ModalTrigger', () => {
    expect(wrapper.find(ModalTrigger)).toHaveLength(1);
  });

  describe('renderTriggerNode', () => {
    it('renders a TooltipWrapper', () => {
      const triggerNode = shallow(
        <div>{wrapper.instance().renderTriggerNode()}</div>,
      );
      expect(triggerNode.find(TooltipWrapper)).toHaveLength(1);
    });
  });

  describe('renderModalBody', () => {
    it('renders a Table', () => {
      const modalBody = shallow(
        <div>{wrapper.instance().renderModalBody()}</div>,
      );
      expect(modalBody.find(Table)).toHaveLength(1);
    });

    it('renders a Thead', () => {
      const modalBody = shallow(
        <div>{wrapper.instance().renderModalBody()}</div>,
      );
      expect(modalBody.find(Thead)).toHaveLength(1);
    });

    it('renders Th', () => {
      const modalBody = shallow(
        <div>{wrapper.instance().renderModalBody()}</div>,
      );
      const th = modalBody.find(Th);
      expect(th).toHaveLength(3);
      ['control', 'before', 'after'].forEach((v, i) => {
        expect(th.get(i).props.column).toBe(v);
      });
    });

    it('renders the correct number of Tr', () => {
      const modalBody = shallow(
        <div>{wrapper.instance().renderModalBody()}</div>,
      );
      const tr = modalBody.find(Tr);
      expect(tr).toHaveLength(7);
    });

    it('renders the correct number of Td', () => {
      const modalBody = shallow(
        <div>{wrapper.instance().renderModalBody()}</div>,
      );
      const td = modalBody.find(Td);
      expect(td).toHaveLength(21);
      ['control', 'before', 'after'].forEach((v, i) => {
        expect(td.get(i).props.column).toBe(v);
      });
    });
  });

  describe('renderRows', () => {
    it('returns an array of rows with one Tr and three Td', () => {
      const rows = wrapper.instance().renderRows();
      expect(rows).toHaveLength(7);
      const fakeRow = shallow(<div>{rows[0]}</div>);
      expect(fakeRow.find(Tr)).toHaveLength(1);
      expect(fakeRow.find(Td)).toHaveLength(3);
    });
  });

  describe('formatValue', () => {
    it('returns "N/A" for undefined values', () => {
      expect(wrapper.instance().formatValue(undefined, 'b')).toBe('N/A');
    });

    it('returns "null" for null values', () => {
      expect(wrapper.instance().formatValue(null, 'b')).toBe('null');
    });

    it('returns "Max" and "Min" for BoundsControl', () => {
      // need to pass the viz type to the wrapper
      expect(wrapper.instance().formatValue([5, 6], 'y_axis_bounds')).toBe(
        'Min: 5, Max: 6',
      );
    });

    it('returns stringified objects for CollectionControl', () => {
      const value = [
        { 1: 2, alpha: 'bravo' },
        { sent: 'imental', w0ke: 5 },
      ];
      const expected = '{"1":2,"alpha":"bravo"}, {"sent":"imental","w0ke":5}';
      expect(wrapper.instance().formatValue(value, 'column_collection')).toBe(
        expected,
      );
    });

    it('returns boolean values as string', () => {
      expect(wrapper.instance().formatValue(true, 'b')).toBe('true');
      expect(wrapper.instance().formatValue(false, 'b')).toBe('false');
    });

    it('returns Array joined by commas', () => {
      const value = [5, 6, 7, 8, 'hello', 'goodbye'];
      const expected = '5, 6, 7, 8, hello, goodbye';
      expect(wrapper.instance().formatValue(value)).toBe(expected);
    });

    it('stringifies objects', () => {
      const value = { 1: 2, alpha: 'bravo' };
      const expected = '{"1":2,"alpha":"bravo"}';
      expect(wrapper.instance().formatValue(value)).toBe(expected);
    });

    it('does nothing to strings and numbers', () => {
      expect(wrapper.instance().formatValue(5)).toBe(5);
      expect(wrapper.instance().formatValue('hello')).toBe('hello');
    });

    it('returns "[]" for empty filters', () => {
      expect(wrapper.instance().formatValue([], 'adhoc_filters')).toBe('[]');
    });

    it('correctly formats filters with array values', () => {
      const filters = [
        {
          clause: 'WHERE',
          comparator: ['1', 'g', '7', 'ho'],
          expressionType: 'SIMPLE',
          operator: 'in',
          subject: 'a',
        },
        {
          clause: 'WHERE',
          comparator: ['hu', 'ho', 'ha'],
          expressionType: 'SIMPLE',
          operator: 'not in',
          subject: 'b',
        },
      ];
      const expected = 'a in [1, g, 7, ho], b not in [hu, ho, ha]';
      expect(wrapper.instance().formatValue(filters, 'adhoc_filters')).toBe(
        expected,
      );
    });

    it('correctly formats filters with string values', () => {
      const filters = [
        {
          clause: 'WHERE',
          comparator: 'gucci',
          expressionType: 'SIMPLE',
          operator: '==',
          subject: 'a',
        },
        {
          clause: 'WHERE',
          comparator: 'moshi moshi',
          expressionType: 'SIMPLE',
          operator: 'LIKE',
          subject: 'b',
        },
      ];
      const expected = 'a == gucci, b LIKE moshi moshi';
      expect(wrapper.instance().formatValue(filters, 'adhoc_filters')).toBe(
        expected,
      );
    });
  });
  describe('isEqualish', () => {
    it('considers null, undefined, {} and [] as equal', () => {
      const inst = wrapper.instance();
      expect(inst.isEqualish(null, undefined)).toBe(true);
      expect(inst.isEqualish(null, [])).toBe(true);
      expect(inst.isEqualish(null, {})).toBe(true);
      expect(inst.isEqualish(undefined, {})).toBe(true);
    });
    it('considers empty strings are the same as null', () => {
      const inst = wrapper.instance();
      expect(inst.isEqualish(undefined, '')).toBe(true);
      expect(inst.isEqualish(null, '')).toBe(true);
    });
    it('considers deeply equal objects as equal', () => {
      const inst = wrapper.instance();
      expect(inst.isEqualish('', '')).toBe(true);
      expect(inst.isEqualish({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 3 })).toBe(
        true,
      );
      // Out of order
      expect(inst.isEqualish({ a: 1, b: 2, c: 3 }, { b: 2, a: 1, c: 3 })).toBe(
        true,
      );

      // Actually  not equal
      expect(inst.isEqualish({ a: 1, b: 2, z: 9 }, { a: 1, b: 2, c: 3 })).toBe(
        false,
      );
    });
  });
});

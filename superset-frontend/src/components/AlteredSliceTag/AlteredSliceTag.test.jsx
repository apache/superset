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
import { styledMount as mount } from 'spec/helpers/theming';
import { getChartControlPanelRegistry } from '@superset-ui/core';

import AlteredSliceTag from 'src/components/AlteredSliceTag';
import ModalTrigger from 'src/components/ModalTrigger';
import { Tooltip } from 'src/components/Tooltip';
import TableCollection from 'src/components/TableCollection';
import TableView from 'src/components/TableView';

import {
  defaultProps,
  expectedDiffs,
  expectedRows,
  fakePluginControls,
} from './AlteredSliceTagMocks';

const getTableWrapperFromModalBody = modalBody =>
  modalBody.find(TableView).find(TableCollection);

describe('AlteredSliceTag', () => {
  let wrapper;
  let props;
  let controlsMap;

  beforeEach(() => {
    getChartControlPanelRegistry().registerValue(
      'altered_slice_tag_spec',
      fakePluginControls,
    );
    props = { ...defaultProps };
    wrapper = mount(<AlteredSliceTag {...props} />);
    ({ controlsMap } = wrapper.instance().state);
  });

  it('correctly determines form data differences', () => {
    const diffs = wrapper.instance().getDiffs(props);
    expect(diffs).toEqual(expectedDiffs);
    expect(wrapper.instance().state.rows).toEqual(expectedRows);
    expect(wrapper.instance().state.hasDiffs).toBe(true);
  });

  it('does not run when there are no differences', () => {
    props = {
      origFormData: props.origFormData,
      currentFormData: props.origFormData,
    };
    wrapper = mount(<AlteredSliceTag {...props} />);
    expect(wrapper.instance().state.rows).toEqual([]);
    expect(wrapper.instance().state.hasDiffs).toBe(false);
    expect(wrapper.instance().render()).toBeNull();
  });

  it('sets new rows when receiving new props', () => {
    const testRows = ['testValue'];
    const getRowsFromDiffsStub = jest
      .spyOn(AlteredSliceTag.prototype, 'getRowsFromDiffs')
      .mockReturnValueOnce(testRows);
    const newProps = {
      currentFormData: { ...props.currentFormData },
      origFormData: { ...props.origFormData },
    };
    wrapper = mount(<AlteredSliceTag {...props} />);
    const wrapperInstance = wrapper.instance();
    wrapperInstance.UNSAFE_componentWillReceiveProps(newProps);
    expect(getRowsFromDiffsStub).toHaveBeenCalled();
    expect(wrapperInstance.state.rows).toEqual(testRows);
  });

  it('does not set new state when props are the same', () => {
    const currentRows = wrapper.instance().state.rows;
    wrapper.instance().UNSAFE_componentWillReceiveProps(props);
    // Check equal references
    expect(wrapper.instance().state.rows).toBe(currentRows);
  });

  it('renders a ModalTrigger', () => {
    expect(wrapper.find(ModalTrigger)).toExist();
  });

  describe('renderTriggerNode', () => {
    it('renders a Tooltip', () => {
      const triggerNode = mount(
        <div>{wrapper.instance().renderTriggerNode()}</div>,
      );
      expect(triggerNode.find(Tooltip)).toHaveLength(1);
    });
  });

  describe('renderModalBody', () => {
    it('renders a Table', () => {
      const modalBody = mount(
        <div>{wrapper.instance().renderModalBody()}</div>,
      );
      expect(modalBody.find(TableView)).toHaveLength(1);
    });

    it('renders a thead', () => {
      const modalBody = mount(
        <div>{wrapper.instance().renderModalBody()}</div>,
      );
      expect(
        getTableWrapperFromModalBody(modalBody).find('thead'),
      ).toHaveLength(1);
    });

    it('renders th', () => {
      const modalBody = mount(
        <div>{wrapper.instance().renderModalBody()}</div>,
      );
      const th = getTableWrapperFromModalBody(modalBody).find('th');
      expect(th).toHaveLength(3);
      ['Control', 'Before', 'After'].forEach(async (v, i) => {
        await expect(th.at(i).find('span').get(0).props.children[0]).toBe(v);
      });
    });

    it('renders the correct number of Tr', () => {
      const modalBody = mount(
        <div>{wrapper.instance().renderModalBody()}</div>,
      );
      const tr = getTableWrapperFromModalBody(modalBody).find('tr');
      expect(tr).toHaveLength(8);
    });

    it('renders the correct number of td', () => {
      const modalBody = mount(
        <div>{wrapper.instance().renderModalBody()}</div>,
      );
      const td = getTableWrapperFromModalBody(modalBody).find('td');
      expect(td).toHaveLength(21);
      ['control', 'before', 'after'].forEach((v, i) => {
        expect(td.find('defaultRenderer').get(0).props.columns[i].id).toBe(v);
      });
    });
  });

  describe('renderRows', () => {
    it('returns an array of rows with one tr and three td', () => {
      const modalBody = mount(
        <div>{wrapper.instance().renderModalBody()}</div>,
      );
      const rows = getTableWrapperFromModalBody(modalBody).find('tr');
      expect(rows).toHaveLength(8);
      const slice = mount(
        <table>
          <tbody>{rows.get(1)}</tbody>
        </table>,
      );
      expect(slice.find('tr')).toHaveLength(1);
      expect(slice.find('td')).toHaveLength(3);
    });
  });

  describe('formatValue', () => {
    it('returns "N/A" for undefined values', () => {
      expect(wrapper.instance().formatValue(undefined, 'b', controlsMap)).toBe(
        'N/A',
      );
    });

    it('returns "null" for null values', () => {
      expect(wrapper.instance().formatValue(null, 'b', controlsMap)).toBe(
        'null',
      );
    });

    it('returns "Max" and "Min" for BoundsControl', () => {
      // need to pass the viz type to the wrapper
      expect(
        wrapper.instance().formatValue([5, 6], 'y_axis_bounds', controlsMap),
      ).toBe('Min: 5, Max: 6');
    });

    it('returns stringified objects for CollectionControl', () => {
      const value = [
        { 1: 2, alpha: 'bravo' },
        { sent: 'imental', w0ke: 5 },
      ];
      const expected = '{"1":2,"alpha":"bravo"}, {"sent":"imental","w0ke":5}';
      expect(
        wrapper.instance().formatValue(value, 'column_collection', controlsMap),
      ).toBe(expected);
    });

    it('returns boolean values as string', () => {
      expect(wrapper.instance().formatValue(true, 'b', controlsMap)).toBe(
        'true',
      );
      expect(wrapper.instance().formatValue(false, 'b', controlsMap)).toBe(
        'false',
      );
    });

    it('returns Array joined by commas', () => {
      const value = [5, 6, 7, 8, 'hello', 'goodbye'];
      const expected = '5, 6, 7, 8, hello, goodbye';
      expect(
        wrapper.instance().formatValue(value, undefined, controlsMap),
      ).toBe(expected);
    });

    it('stringifies objects', () => {
      const value = { 1: 2, alpha: 'bravo' };
      const expected = '{"1":2,"alpha":"bravo"}';
      expect(
        wrapper.instance().formatValue(value, undefined, controlsMap),
      ).toBe(expected);
    });

    it('does nothing to strings and numbers', () => {
      expect(wrapper.instance().formatValue(5, undefined, controlsMap)).toBe(5);
      expect(
        wrapper.instance().formatValue('hello', undefined, controlsMap),
      ).toBe('hello');
    });

    it('returns "[]" for empty filters', () => {
      expect(
        wrapper.instance().formatValue([], 'adhoc_filters', controlsMap),
      ).toBe('[]');
    });

    it('correctly formats filters with array values', () => {
      const filters = [
        {
          clause: 'WHERE',
          comparator: ['1', 'g', '7', 'ho'],
          expressionType: 'SIMPLE',
          operator: 'IN',
          subject: 'a',
        },
        {
          clause: 'WHERE',
          comparator: ['hu', 'ho', 'ha'],
          expressionType: 'SIMPLE',
          operator: 'NOT IN',
          subject: 'b',
        },
      ];
      const expected = 'a IN [1, g, 7, ho], b NOT IN [hu, ho, ha]';
      expect(
        wrapper.instance().formatValue(filters, 'adhoc_filters', controlsMap),
      ).toBe(expected);
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
      expect(
        wrapper.instance().formatValue(filters, 'adhoc_filters', controlsMap),
      ).toBe(expected);
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

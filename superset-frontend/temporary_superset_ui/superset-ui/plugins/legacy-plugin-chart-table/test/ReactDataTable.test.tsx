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
import { mount, CommonWrapper } from 'enzyme';
import ReactDataTable from '../src/ReactDataTable';
import transformProps from '../src/transformProps';
import testData from './testData';

describe('legacy-table', () => {
  // Can test more prop transformation here. Not needed for now.
  describe('transformProps', () => {
    it('should parse pageLength', () => {
      expect(transformProps(testData.basic).pageLength).toBe(20);
      expect(
        transformProps({
          ...testData.basic,
          formData: { ...testData.basic.formData, pageLength: '20' },
        }).pageLength,
      ).toBe(20);
      expect(
        transformProps({
          ...testData.basic,
          formData: { ...testData.basic.formData, pageLength: '' },
        }).pageLength,
      ).toBe(0);
    });
  });

  describe('ReactDataTable', () => {
    let wrap: CommonWrapper; // the ReactDataTable wraper

    it('render basic data', () => {
      wrap = mount(<ReactDataTable {...transformProps(testData.basic)} />);
      const tree = wrap.render(); // returns a CheerioWrapper with jQuery-like API
      const cells = tree.find('td');
      expect(tree.hasClass('superset-legacy-chart-table')).toEqual(true);
      expect(cells).toHaveLength(6);
      expect(cells.eq(0).text()).toEqual('2020-01-01 12:34:56');
      expect(cells.eq(1).text()).toEqual('Michael');
      // number is not in `metrics` list, so it should output raw value
      // (in real world Superset, this would mean the column is used in GROUP BY)
      expect(cells.eq(5).text()).toEqual('2467');
      expect(cells.eq(5).attr('data-sort')).toEqual('2467');
    });

    it('render advanced data', () => {
      // should successfull rerender with new props
      wrap.setProps(transformProps(testData.advanced));
      const tree = wrap.render();
      const cells = tree.find('td');
      expect(tree.find('th').eq(1).text()).toEqual('Sum of Num');
      expect(cells.eq(2).text()).toEqual('12.346%');
      expect(cells.eq(4).text()).toEqual('2.47k');
      expect(cells.eq(4).attr('data-sort')).toEqual('2467');
    });

    it('render empty data', () => {
      wrap.setProps(transformProps(testData.empty));
      const tree = wrap.render();
      expect(tree.text()).toContain('No data available in table');
    });
  });
});

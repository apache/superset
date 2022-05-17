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
import { CommonWrapper } from 'enzyme';
import TableChart from '../src/TableChart';
import transformProps from '../src/transformProps';
import DateWithFormatter from '../src/utils/DateWithFormatter';
import testData from './testData';
import { mount } from './enzyme';

describe('plugin-chart-table', () => {
  describe('transformProps', () => {
    it('should parse pageLength to pageSize', () => {
      expect(transformProps(testData.basic).pageSize).toBe(20);
      expect(
        transformProps({
          ...testData.basic,
          rawFormData: { ...testData.basic.rawFormData, page_length: '20' },
        }).pageSize,
      ).toBe(20);
      expect(
        transformProps({
          ...testData.basic,
          rawFormData: { ...testData.basic.rawFormData, page_length: '' },
        }).pageSize,
      ).toBe(0);
    });

    it('should memoize data records', () => {
      expect(transformProps(testData.basic).data).toBe(
        transformProps(testData.basic).data,
      );
    });

    it('should memoize columns meta', () => {
      expect(transformProps(testData.basic).columns).toBe(
        transformProps({
          ...testData.basic,
          rawFormData: { ...testData.basic.rawFormData, pageLength: null },
        }).columns,
      );
    });

    it('should format timestamp', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parsedDate = transformProps(testData.basic).data[0]
        .__timestamp as DateWithFormatter;
      expect(String(parsedDate)).toBe('2020-01-01 12:34:56');
      expect(parsedDate.getTime()).toBe(1577882096000);
    });
  });

  describe('TableChart', () => {
    let wrap: CommonWrapper; // the ReactDataTable wraper
    let tree: Cheerio;

    it('render basic data', () => {
      wrap = mount(
        <TableChart {...transformProps(testData.basic)} sticky={false} />,
      );
      tree = wrap.render(); // returns a CheerioWrapper with jQuery-like API
      const cells = tree.find('td');
      expect(cells).toHaveLength(12);
      expect(cells.eq(0).text()).toEqual('2020-01-01 12:34:56');
      expect(cells.eq(1).text()).toEqual('Michael');
      // number is not in `metrics` list, so it should output raw value
      // (in real world Superset, this would mean the column is used in GROUP BY)
      expect(cells.eq(2).text()).toEqual('2467063');
      // should not render column with `.` in name as `undefined`
      expect(cells.eq(3).text()).toEqual('foo');
      expect(cells.eq(6).text()).toEqual('2467');
      expect(cells.eq(8).text()).toEqual('N/A');
    });

    it('render advanced data', () => {
      wrap = mount(
        <TableChart {...transformProps(testData.advanced)} sticky={false} />,
      );
      tree = wrap.render();
      // should successfull rerender with new props
      const cells = tree.find('td');
      expect(tree.find('th').eq(1).text()).toEqual('Sum of Num');
      expect(cells.eq(2).text()).toEqual('12.346%');
      expect(cells.eq(4).text()).toEqual('2.47k');
    });

    it('render empty data', () => {
      wrap.setProps({ ...transformProps(testData.empty), sticky: false });
      tree = wrap.render();
      expect(tree.text()).toContain('No records found');
    });
  });
});

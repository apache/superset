/*
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

import { Behavior, ChartProps, supersetTheme } from '@superset-ui/core';

const RAW_FORM_DATA = {
  some_field: 1,
};

const RAW_DATASOURCE = {
  column_formats: { test: '%s' },
};

const QUERY_DATA = { data: {} };
const QUERIES_DATA = [QUERY_DATA];
const BEHAVIORS = [Behavior.NATIVE_FILTER, Behavior.INTERACTIVE_CHART];

describe('ChartProps', () => {
  it('exists', () => {
    expect(ChartProps).toBeDefined();
  });
  describe('new ChartProps({})', () => {
    it('returns new instance', () => {
      const props = new ChartProps({
        width: 800,
        height: 600,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
        theme: supersetTheme,
      });
      expect(props).toBeInstanceOf(ChartProps);
    });
    it('processes formData and datasource to convert field names to camelCase', () => {
      const props = new ChartProps({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
        theme: supersetTheme,
      });
      expect(props.formData.someField as number).toEqual(1);
      expect(props.datasource.columnFormats).toEqual(
        RAW_DATASOURCE.column_formats,
      );
      expect(props.rawFormData).toEqual(RAW_FORM_DATA);
      expect(props.rawDatasource).toEqual(RAW_DATASOURCE);
    });
  });
  describe('ChartProps.createSelector()', () => {
    const selector = ChartProps.createSelector();
    it('returns a selector function', () => {
      expect(selector).toBeInstanceOf(Function);
    });
    it('selector returns previous chartProps if all input fields do not change', () => {
      const props1 = selector({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
        behaviors: BEHAVIORS,
        isRefreshing: false,
        theme: supersetTheme,
      });
      const props2 = selector({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
        behaviors: BEHAVIORS,
        isRefreshing: false,
        theme: supersetTheme,
      });
      expect(props1).toBe(props2);
    });
    it('selector returns a new chartProps if the 13th field changes', () => {
      /** this test is here to test for selectors that exceed 12 arguments (
       * isRefreshing is the 13th argument, which is missing TS declarations).
       * See: https://github.com/reduxjs/reselect/issues/378
       */

      const props1 = selector({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
        behaviors: BEHAVIORS,
        isRefreshing: false,
        theme: supersetTheme,
      });
      const props2 = selector({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
        behaviors: BEHAVIORS,
        isRefreshing: true,
        theme: supersetTheme,
      });
      expect(props1).not.toBe(props2);
    });
    it('selector returns a new chartProps if some input fields change', () => {
      const props1 = selector({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
        theme: supersetTheme,
      });
      const props2 = selector({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: { new_field: 3 },
        queriesData: QUERIES_DATA,
        theme: supersetTheme,
      });
      const props3 = selector({
        width: 800,
        height: 600,
        datasource: RAW_DATASOURCE,
        formData: RAW_FORM_DATA,
        queriesData: QUERIES_DATA,
        theme: supersetTheme,
      });
      expect(props1).not.toBe(props2);
      expect(props1).not.toBe(props3);
    });
  });
});

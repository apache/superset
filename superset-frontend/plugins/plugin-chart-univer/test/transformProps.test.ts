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
import { AppSection, ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps from '../src/plugin/transformProps';

const build = (appSection?: AppSection) =>
  transformProps(
    new ChartProps({
      width: 400,
      height: 300,
      formData: { viz_type: 'univer_sheet', univer_workbook: '{}' },
      queriesData: [{ data: [{ a: 1 }], colnames: ['a'], coltypes: [0] }],
      appSection,
      theme: supersetTheme,
    }),
  );

test('only Explore gets the editable spreadsheet', () => {
  expect(build(AppSection.Explore).editable).toBe(true);
  expect(build(AppSection.Dashboard).editable).toBe(false);
  expect(build(AppSection.Embedded).editable).toBe(false);
  expect(build().editable).toBe(false);
});

test('reads Univer settings from the raw form data', () => {
  const props = build(AppSection.Explore);
  expect(props.savedState).toBe('{}');
  expect(props.liveData).toBe(true);
  expect(props.showHeaders).toBe(false);
  expect(props.colnames).toEqual(['a']);
});

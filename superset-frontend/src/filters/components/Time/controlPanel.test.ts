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
import { getControlItems } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/utils';
import controlPanel from './controlPanel';

// The native filter settings dialog renders each UI Configuration option as a
// checkbox (only a few names such as displayFormat are handled separately), so
// an option of another control type would be saved as a boolean.
const NOT_RENDERED_AS_CHECKBOX = ['displayFormat'];

test('every UI option the settings dialog renders as a checkbox is a checkbox control', () => {
  const options = getControlItems(controlPanel).filter(
    item =>
      item.config?.renderTrigger &&
      !NOT_RENDERED_AS_CHECKBOX.includes(item.name),
  );
  expect(options.length).toBeGreaterThan(0);
  options.forEach(item => {
    expect(item.config.type).toBe('CheckboxControl');
  });
});

test('the calendar date picker option exists and is off by default', () => {
  const option = getControlItems(controlPanel).find(
    item => item.name === 'calendarPicker',
  );
  expect(option?.config.type).toBe('CheckboxControl');
  expect(option?.config.default).toBe(false);
});

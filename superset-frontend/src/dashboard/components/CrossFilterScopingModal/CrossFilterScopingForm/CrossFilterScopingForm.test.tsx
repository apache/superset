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
import { render } from 'spec/helpers/testing-library';
import FilterScope from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/FilterScope/FilterScope';
import CrossFilterScopingForm from '.';

jest.mock(
  'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/FilterScope/FilterScope',
  () => jest.fn(() => null),
);

const createProps = () => {
  const getFieldValue = jest.fn();
  getFieldValue.mockImplementation(name => name);
  return {
    chartId: 123,
    scope: 'Scope',
    form: { getFieldValue },
  };
};

test('Should send correct props', () => {
  const props = createProps();
  render(<CrossFilterScopingForm {...(props as any)} />);

  expect(FilterScope).toHaveBeenCalledWith(
    expect.objectContaining({
      chartId: 123,
      filterScope: 'Scope',
      formFilterScope: 'scope',
      formScopingType: 'scoping',
    }),
    {},
  );
});

test('Should get correct filds', () => {
  const props = createProps();
  render(<CrossFilterScopingForm {...(props as any)} />);
  expect(props.form.getFieldValue).toBeCalledTimes(2);
  expect(props.form.getFieldValue).toHaveBeenNthCalledWith(1, 'scope');
  expect(props.form.getFieldValue).toHaveBeenNthCalledWith(2, 'scoping');
});

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
import { mount } from 'enzyme';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import CreateFilterButton from 'src/dashboard/components/nativeFilters/CreateFilterButton';

describe('CreateFilterButton', () => {
  const mockedProps = {};
  it('it is valid', () => {
    expect(React.isValidElement(<CreateFilterButton {...mockedProps} />)).toBe(
      true,
    );
  });
  it('takes in children', () => {
    const wrapper = mount(
      <CreateFilterButton>
        <span>Test</span>{' '}
      </CreateFilterButton>,
      {
        wrappingComponent: ThemeProvider,
        wrappingComponentProps: {
          theme: supersetTheme,
        },
      },
    );
    expect(wrapper.find('span')).toHaveLength(1);
  });
});

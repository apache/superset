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
import { Provider } from 'react-redux';
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import { mockStoreWithChartsInTabsAndRoot } from 'spec/fixtures/mockStore';
import { Form, FormInstance } from 'src/common/components';
import { NativeFiltersForm } from 'src/dashboard/components/nativeFilters/types';
import FilterConfigForm from 'src/dashboard/components/nativeFilters/FilterConfigForm';

describe('FilterScope', () => {
  const save = jest.fn();
  let form: FormInstance<NativeFiltersForm>;
  const mockedProps = {
    filterId: 'DefaultFilterId',
    restore: jest.fn(),
    parentFilters: [],
    save,
  };

  const MockModal = ({ scope }: { scope: object | undefined }) => {
    const [newForm] = Form.useForm<NativeFiltersForm>();
    form = newForm;
    if (scope) {
      form.setFieldsValue({
        filters: {
          [mockedProps.filterId]: {
            scope,
          },
        },
      });
    }
    return (
      <Provider store={mockStoreWithChartsInTabsAndRoot}>
        <Form form={form}>
          <FilterConfigForm form={form} {...mockedProps} />
        </Form>
      </Provider>
    );
  };

  const getWrapper = (scope?: object) => {
    render(<MockModal scope={scope} />);
  };

  const getTreeSwitcher = (order = 0) =>
    document.querySelectorAll('.ant-tree-switcher')[order];

  it('renders "apply to all" filter scope', () => {
    getWrapper();
    expect(screen.queryByRole('tree')).toBe(null);
  });

  it('select tree values with 1 excluded', () => {
    getWrapper();
    fireEvent.click(screen.getByLabelText('Apply to specific panels'));
    expect(screen.getByRole('tree')).not.toBe(null);
    fireEvent.click(getTreeSwitcher(2));
    fireEvent.click(screen.getByText('CHART_ID2'));
    expect(form.getFieldValue('filters')?.[mockedProps.filterId].scope).toEqual(
      {
        excluded: [20],
        rootPath: ['ROOT_ID'],
      },
    );
  });

  it('select 1 value only', () => {
    getWrapper();
    fireEvent.click(screen.getByLabelText('Apply to specific panels'));
    expect(screen.getByRole('tree')).not.toBe(null);
    fireEvent.click(getTreeSwitcher(2));
    fireEvent.click(screen.getByText('CHART_ID2'));
    fireEvent.click(screen.getByText('tab1'));
    expect(form.getFieldValue('filters')?.[mockedProps.filterId].scope).toEqual(
      {
        excluded: [18, 20],
        rootPath: ['ROOT_ID'],
      },
    );
  });

  it('correct init tree with values', () => {
    getWrapper({
      rootPath: ['TAB_ID'],
      excluded: [],
    });
    fireEvent.click(screen.getByLabelText('Apply to specific panels'));
    expect(screen.getByRole('tree')).not.toBe(null);
    expect(document.querySelectorAll('.ant-tree-checkbox-checked').length).toBe(
      1,
    );
  });
});

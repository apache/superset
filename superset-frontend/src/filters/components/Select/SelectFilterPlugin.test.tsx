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
import userEvent from '@testing-library/user-event';
import { AppSection } from '@superset-ui/core';
import { render, screen } from 'spec/helpers/testing-library';
import { NULL_STRING } from 'src/utils/common';
import SelectFilterPlugin from './SelectFilterPlugin';
import transformProps from './transformProps';

jest.useFakeTimers();

const selectMultipleProps = {
  formData: {
    sortAscending: true,
    multiSelect: true,
    enableEmptyFilter: true,
    defaultToFirstItem: false,
    inverseSelection: false,
    searchAllOptions: false,
    datasource: '3__table',
    groupby: ['gender'],
    adhocFilters: [],
    extraFilters: [],
    extraFormData: {},
    granularitySqla: 'ds',
    metrics: ['count'],
    rowLimit: 1000,
    showSearch: true,
    defaultValue: ['boy'],
    timeRangeEndpoints: ['inclusive', 'exclusive'],
    urlParams: {},
    vizType: 'filter_select',
    inputRef: { current: null },
  },
  height: 20,
  hooks: {},
  ownState: {},
  filterState: { value: ['boy'] },
  queriesData: [
    {
      rowcount: 2,
      colnames: ['gender'],
      coltypes: [1],
      data: [{ gender: 'boy' }, { gender: 'girl' }, { gender: null }],
      applied_filters: [{ column: 'gender' }],
      rejected_filters: [],
    },
  ],
  width: 220,
  behaviors: ['NATIVE_FILTER'],
  isRefreshing: false,
  appSection: AppSection.Dashboard,
};

describe('SelectFilterPlugin', () => {
  const setDataMask = jest.fn();
  const getWrapper = (props = {}) =>
    render(
      // @ts-ignore
      <SelectFilterPlugin
        // @ts-ignore
        {...transformProps({
          ...selectMultipleProps,
          formData: { ...selectMultipleProps.formData, ...props },
        })}
        setDataMask={setDataMask}
      />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Add multiple values with first render', async () => {
    getWrapper();
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        filters: [
          {
            col: 'gender',
            op: 'IN',
            val: ['boy'],
          },
        ],
      },
      filterState: {
        label: 'boy',
        value: ['boy'],
      },
    });
    userEvent.click(screen.getByRole('combobox'));
    userEvent.click(screen.getByTitle('girl'));
    expect(await screen.findByTitle(/girl/i)).toBeInTheDocument();
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        filters: [
          {
            col: 'gender',
            op: 'IN',
            val: ['boy', 'girl'],
          },
        ],
      },
      filterState: {
        label: 'boy, girl',
        value: ['boy', 'girl'],
      },
    });
  });

  test('Remove multiple values when required', () => {
    getWrapper();
    userEvent.click(
      screen.getByRole('img', {
        name: /close-circle/i,
        hidden: true,
      }),
    );
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        adhoc_filters: [
          {
            clause: 'WHERE',
            expressionType: 'SQL',
            sqlExpression: '1 = 0',
          },
        ],
      },
      filterState: {
        label: undefined,
        value: null,
      },
    });
  });

  test('Remove multiple values when not required', () => {
    getWrapper({ enableEmptyFilter: false });
    userEvent.click(
      screen.getByRole('img', {
        name: /close-circle/i,
        hidden: true,
      }),
    );
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {},
      filterState: {
        label: undefined,
        value: null,
      },
    });
  });

  test('Select single values with inverse', async () => {
    getWrapper({ multiSelect: false, inverseSelection: true });
    userEvent.click(screen.getByRole('combobox'));
    expect(await screen.findByTitle('girl')).toBeInTheDocument();
    userEvent.click(screen.getByTitle('girl'));
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        filters: [
          {
            col: 'gender',
            op: 'NOT IN',
            val: ['girl'],
          },
        ],
      },
      filterState: {
        label: 'girl (excluded)',
        value: ['girl'],
      },
    });
  });

  test('Select single null (empty) value', async () => {
    getWrapper();
    userEvent.click(screen.getByRole('combobox'));
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    userEvent.click(screen.getByTitle(NULL_STRING));
    expect(setDataMask).toHaveBeenLastCalledWith({
      extraFormData: {
        filters: [
          {
            col: 'gender',
            op: 'IN',
            val: ['boy', null],
          },
        ],
      },
      filterState: {
        label: `boy, ${NULL_STRING}`,
        value: ['boy', null],
      },
    });
  });

  test('receives the correct filter when search all options', async () => {
    getWrapper({ searchAllOptions: true, multiSelect: false });
    userEvent.click(screen.getByRole('combobox'));
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    userEvent.click(screen.getByTitle('girl'));
    expect(setDataMask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        extraFormData: {
          filters: [
            {
              col: 'gender',
              op: 'IN',
              val: ['girl'],
            },
          ],
        },
      }),
    );
  });
  test('number of fired queries when searching', async () => {
    getWrapper({ searchAllOptions: true });
    userEvent.click(screen.getByRole('combobox'));
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('combobox'), 'a');
    // Closes the select
    userEvent.tab();
    // One call for the search term and other for the empty search
    expect(setDataMask).toHaveBeenCalledTimes(2);
  });
});

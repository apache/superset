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
import { AppSection } from '@superset-ui/core';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { NULL_STRING } from 'src/utils/common';
import SelectFilterPlugin from './SelectFilterPlugin';
import transformProps from './transformProps';

jest.useFakeTimers();

const selectMultipleProps = {
  formData: {
    sortAscending: true,
    creatable: false,
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
    nativeFilterId: 'test-filter',
  },
  height: 20,
  width: 220,
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
        showOverflow={false}
      />,
      {
        useRedux: true,
        initialState: {
          nativeFilters: {
            filters: {
              'test-filter': {
                name: 'Test Filter',
              },
            },
          },
          dataMask: {
            'test-filter': {
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
                value: ['boy'],
                label: 'boy',
                excludeFilterValues: true,
              },
            },
          },
        },
      },
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
        excludeFilterValues: true,
      },
    });

    const filterSelect = screen.getAllByRole('combobox')[0];
    userEvent.click(filterSelect);
    userEvent.click(screen.getByTitle('girl'));
    expect(
      await screen.findByRole('option', { name: /girl/i }),
    ).toBeInTheDocument();
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
        excludeFilterValues: true,
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
        excludeFilterValues: true,
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
        excludeFilterValues: true,
      },
    });
  });

  test('Select single values with inverse', async () => {
    getWrapper({ multiSelect: false, inverseSelection: true });

    // Get the main filter select (second combobox)
    const filterSelect = screen.getAllByRole('combobox')[1];
    userEvent.click(filterSelect);

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
        excludeFilterValues: true,
      },
    });
  });

  test('Select single null (empty) value', async () => {
    getWrapper();
    const filterSelect = screen.getAllByRole('combobox')[0];
    userEvent.click(filterSelect);
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
        excludeFilterValues: true,
      },
    });
  });

  test('receives the correct filter when search all options', async () => {
    getWrapper({ searchAllOptions: true, multiSelect: false });
    const filterSelect = screen.getAllByRole('combobox')[0];
    userEvent.click(filterSelect);
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
    const filterSelect = screen.getAllByRole('combobox')[0];
    userEvent.click(filterSelect);
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('combobox'), 'a');
    userEvent.tab();
    expect(setDataMask).toHaveBeenCalledTimes(2);
  });

  test('Select big int value', async () => {
    const bigValue = 1100924931345932234n;
    render(
      // @ts-ignore
      <SelectFilterPlugin
        // @ts-ignore
        {...transformProps({
          ...selectMultipleProps,
          formData: { ...selectMultipleProps.formData, groupby: 'bval' },
        })}
        coltypeMap={{ bval: 1 }}
        data={[{ bval: bigValue }]}
        setDataMask={jest.fn()}
        showOverflow={false}
      />,
      {
        useRedux: true,
        initialState: {
          nativeFilters: {
            filters: {
              'test-filter': {
                name: 'Test Filter',
              },
            },
          },
          dataMask: {
            'test-filter': {
              extraFormData: {},
              filterState: {
                value: [],
                label: '',
                excludeFilterValues: true,
              },
            },
          },
        },
      },
    );
    const filterSelect = screen.getAllByRole('combobox')[0];
    userEvent.click(filterSelect);
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('combobox'), '1');
    expect(
      await screen.findByRole('option', { name: String(bigValue) }),
    ).toBeInTheDocument();
  });

  test('Is/Is Not select is visible when inverseSelection is true', () => {
    getWrapper({ inverseSelection: true });
    expect(screen.getByText('is not')).toBeInTheDocument();
  });

  test('Is/Is Not select is not visible when inverseSelection is false', () => {
    getWrapper({ inverseSelection: false });
    expect(screen.queryByText('is not')).not.toBeInTheDocument();
  });

  test('Is/Is Not select toggles correctly', async () => {
    getWrapper({ inverseSelection: true });

    const isNotSelect = screen.getByText('is not');
    expect(isNotSelect).toBeInTheDocument();

    // Click to open dropdown
    userEvent.click(isNotSelect);

    // Click "is" option
    userEvent.click(screen.getByText('is'));

    // Should update excludeFilterValues to false
    expect(setDataMask).toHaveBeenCalledWith(
      expect.objectContaining({
        filterState: expect.objectContaining({
          excludeFilterValues: false,
        }),
      }),
    );
  });

  test('Should not allow for new values when creatable is false', () => {
    getWrapper({ creatable: false });
    userEvent.type(screen.getByRole('combobox'), 'new value');
    expect(screen.queryByTitle('new value')).not.toBeInTheDocument();
  });

  test('Should allow for new values when creatable is true', async () => {
    getWrapper({ creatable: true });
    userEvent.type(screen.getByRole('combobox'), 'new value');
    expect(await screen.findByTitle('new value')).toBeInTheDocument();
  });

  test('preserves backend order when sortMetric is specified', () => {
    const testData = [
      { gender: 'zebra' },
      { gender: 'alpha' },
      { gender: 'beta' },
    ];

    const testProps = {
      ...selectMultipleProps,
      formData: {
        ...selectMultipleProps.formData,
        sortMetric: 'count',
        sortAscending: true,
      },
      queriesData: [
        {
          rowcount: 3,
          colnames: ['gender'],
          coltypes: [1],
          data: testData,
          applied_filters: [{ column: 'gender' }],
          rejected_filters: [],
        },
      ],
      filterState: {
        value: [],
        label: '',
        excludeFilterValues: true,
      },
    };

    render(
      // @ts-ignore
      <SelectFilterPlugin
        // @ts-ignore
        {...transformProps(testProps)}
        setDataMask={jest.fn()}
        showOverflow={false}
      />,
      {
        useRedux: true,
        initialState: {
          nativeFilters: {
            filters: {
              'test-filter': {
                name: 'Test Filter',
              },
            },
          },
          dataMask: {
            'test-filter': {
              extraFormData: {},
              filterState: {
                value: [],
                label: '',
                excludeFilterValues: true,
              },
            },
          },
        },
      },
    );

    const filterSelect = screen.getAllByRole('combobox')[0];
    userEvent.click(filterSelect);

    // When sortMetric is specified, options should appear in the original data order
    // (zebra, alpha, beta) not alphabetically sorted
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('zebra');
    expect(options[1]).toHaveTextContent('alpha');
    expect(options[2]).toHaveTextContent('beta');
  });

  test('applies alphabetical sorting when sortMetric is not specified', () => {
    const testData = [
      { gender: 'zebra' },
      { gender: 'alpha' },
      { gender: 'beta' },
    ];

    const testProps = {
      ...selectMultipleProps,
      formData: {
        ...selectMultipleProps.formData,
        sortMetric: undefined,
        sortAscending: true,
      },
      queriesData: [
        {
          rowcount: 3,
          colnames: ['gender'],
          coltypes: [1],
          data: testData,
          applied_filters: [{ column: 'gender' }],
          rejected_filters: [],
        },
      ],
      filterState: {
        value: [],
        label: '',
        excludeFilterValues: true,
      },
    };

    render(
      // @ts-ignore
      <SelectFilterPlugin
        // @ts-ignore
        {...transformProps(testProps)}
        setDataMask={jest.fn()}
        showOverflow={false}
      />,
      {
        useRedux: true,
        initialState: {
          nativeFilters: {
            filters: {
              'test-filter': {
                name: 'Test Filter',
              },
            },
          },
          dataMask: {
            'test-filter': {
              extraFormData: {},
              filterState: {
                value: [],
                label: '',
                excludeFilterValues: true,
              },
            },
          },
        },
      },
    );

    const filterSelect = screen.getAllByRole('combobox')[0];
    userEvent.click(filterSelect);

    // When sortMetric is not specified, options should be sorted alphabetically
    // (alpha, beta, zebra)
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('alpha');
    expect(options[1]).toHaveTextContent('beta');
    expect(options[2]).toHaveTextContent('zebra');
  });

  test('applies descending alphabetical sorting when sortAscending is false and no sortMetric', () => {
    const testData = [
      { gender: 'zebra' },
      { gender: 'alpha' },
      { gender: 'beta' },
    ];

    const testProps = {
      ...selectMultipleProps,
      formData: {
        ...selectMultipleProps.formData,
        sortMetric: undefined,
        sortAscending: false,
      },
      queriesData: [
        {
          rowcount: 3,
          colnames: ['gender'],
          coltypes: [1],
          data: testData,
          applied_filters: [{ column: 'gender' }],
          rejected_filters: [],
        },
      ],
      filterState: {
        value: [],
        label: '',
        excludeFilterValues: true,
      },
    };

    render(
      // @ts-ignore
      <SelectFilterPlugin
        // @ts-ignore
        {...transformProps(testProps)}
        setDataMask={jest.fn()}
        showOverflow={false}
      />,
      {
        useRedux: true,
        initialState: {
          nativeFilters: {
            filters: {
              'test-filter': {
                name: 'Test Filter',
              },
            },
          },
          dataMask: {
            'test-filter': {
              extraFormData: {},
              filterState: {
                value: [],
                label: '',
                excludeFilterValues: true,
              },
            },
          },
        },
      },
    );

    const filterSelect = screen.getAllByRole('combobox')[0];
    userEvent.click(filterSelect);

    // When sortAscending is false and no sortMetric, options should be sorted
    // in descending alphabetical order (zebra, beta, alpha)
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('zebra');
    expect(options[1]).toHaveTextContent('beta');
    expect(options[2]).toHaveTextContent('alpha');
  });

  test('preserves backend order even when sortAscending is false and sortMetric is specified', () => {
    const testData = [
      { gender: 'zebra' },
      { gender: 'alpha' },
      { gender: 'beta' },
    ];

    const testProps = {
      ...selectMultipleProps,
      formData: {
        ...selectMultipleProps.formData,
        sortMetric: 'count',
        sortAscending: false,
      },
      queriesData: [
        {
          rowcount: 3,
          colnames: ['gender'],
          coltypes: [1],
          data: testData,
          applied_filters: [{ column: 'gender' }],
          rejected_filters: [],
        },
      ],
      filterState: {
        value: [],
        label: '',
        excludeFilterValues: true,
      },
    };

    render(
      // @ts-ignore
      <SelectFilterPlugin
        // @ts-ignore
        {...transformProps(testProps)}
        setDataMask={jest.fn()}
        showOverflow={false}
      />,
      {
        useRedux: true,
        initialState: {
          nativeFilters: {
            filters: {
              'test-filter': {
                name: 'Test Filter',
              },
            },
          },
          dataMask: {
            'test-filter': {
              extraFormData: {},
              filterState: {
                value: [],
                label: '',
                excludeFilterValues: true,
              },
            },
          },
        },
      },
    );

    const filterSelect = screen.getAllByRole('combobox')[0];
    userEvent.click(filterSelect);

    // When sortMetric is specified, original order should be preserved regardless
    // of sortAscending value (zebra, alpha, beta)
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('zebra');
    expect(options[1]).toHaveTextContent('alpha');
    expect(options[2]).toHaveTextContent('beta');
  });
});

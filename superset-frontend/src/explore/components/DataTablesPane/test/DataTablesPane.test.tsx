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
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { FeatureFlag } from '@superset-ui/core';
import * as copyUtils from 'src/utils/copy';
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from 'spec/helpers/testing-library';
import { setItem, LocalStorageKeys } from 'src/utils/localStorageHelpers';
import { DataTablesPane } from '..';
import { createDataTablesPaneProps } from './fixture';

describe('DataTablesPane', () => {
  // Collapsed/expanded state depends on local storage
  // We need to clear it manually - otherwise initial state would depend on the order of tests
  beforeEach(() => {
    localStorage.clear();
  });

  afterAll(() => {
    localStorage.clear();
  });

  test('Rendering DataTablesPane correctly', async () => {
    const props = createDataTablesPaneProps(0);
    render(<DataTablesPane {...props} />, { useRedux: true });
    expect(await screen.findByText('Results')).toBeVisible();
    expect(screen.getByText('Samples')).toBeVisible();
    expect(screen.getByLabelText('Expand data panel')).toBeVisible();
  });

  test('Collapse/Expand buttons', async () => {
    const props = createDataTablesPaneProps(0);
    render(<DataTablesPane {...props} />, {
      useRedux: true,
    });
    expect(
      screen.queryByLabelText('Collapse data panel'),
    ).not.toBeInTheDocument();
    userEvent.click(screen.getByLabelText('Expand data panel'));
    expect(await screen.findByLabelText('Collapse data panel')).toBeVisible();
    expect(
      screen.queryByLabelText('Expand data panel'),
    ).not.toBeInTheDocument();
  });

  test('Should show tabs: View results', async () => {
    const props = createDataTablesPaneProps(0);
    render(<DataTablesPane {...props} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByText('Results'));
    expect(await screen.findByText('0 rows')).toBeVisible();
    expect(await screen.findByLabelText('Collapse data panel')).toBeVisible();
    localStorage.clear();
  });
  test('Should show tabs: View samples', async () => {
    const props = createDataTablesPaneProps(0);
    render(<DataTablesPane {...props} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByText('Samples'));
    expect(await screen.findByText('0 rows')).toBeVisible();
    expect(await screen.findByLabelText('Collapse data panel')).toBeVisible();
  });

  test('Should copy data table content correctly', async () => {
    fetchMock.post(
      'glob:*/api/v1/chart/data?form_data=%7B%22slice_id%22%3A456%7D',
      {
        result: [
          {
            data: [{ __timestamp: 1230768000000, genre: 'Action' }],
            colnames: ['__timestamp', 'genre'],
            coltypes: [2, 1],
          },
        ],
      },
    );
    const copyToClipboardSpy = jest.spyOn(copyUtils, 'default');
    const props = createDataTablesPaneProps(456);
    render(<DataTablesPane {...props} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByText('Results'));
    expect(await screen.findByText('1 row')).toBeVisible();

    userEvent.click(screen.getByLabelText('Copy'));
    expect(copyToClipboardSpy).toHaveBeenCalledTimes(1);
    const value = await copyToClipboardSpy.mock.calls[0][0]();
    expect(value).toBe('__timestamp\tgenre\n2009-01-01 00:00:00\tAction\n');
    copyToClipboardSpy.mockRestore();
    fetchMock.restore();
  });

  test('Search table', async () => {
    fetchMock.post(
      'glob:*/api/v1/chart/data?form_data=%7B%22slice_id%22%3A789%7D',
      {
        result: [
          {
            data: [
              { __timestamp: 1230768000000, genre: 'Action' },
              { __timestamp: 1230768000010, genre: 'Horror' },
            ],
            colnames: ['__timestamp', 'genre'],
            coltypes: [2, 1],
          },
        ],
      },
    );
    const props = createDataTablesPaneProps(789);
    render(<DataTablesPane {...props} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByText('Results'));
    expect(await screen.findByText('2 rows')).toBeVisible();
    expect(screen.getByText('Action')).toBeVisible();
    expect(screen.getByText('Horror')).toBeVisible();

    userEvent.type(screen.getByPlaceholderText('Search'), 'hor');

    await waitForElementToBeRemoved(() => screen.queryByText('Action'));
    expect(screen.getByText('Horror')).toBeVisible();
    expect(screen.queryByText('Action')).not.toBeInTheDocument();
    fetchMock.restore();
  });

  test('Displaying the data pane is under featureflag', () => {
    // @ts-ignore
    global.featureFlags = {
      [FeatureFlag.DATAPANEL_CLOSED_BY_DEFAULT]: true,
    };
    const props = createDataTablesPaneProps(0);
    setItem(LocalStorageKeys.is_datapanel_open, true);
    render(<DataTablesPane {...props} />, {
      useRedux: true,
    });
    expect(
      screen.queryByLabelText('Collapse data panel'),
    ).not.toBeInTheDocument();
  });
});

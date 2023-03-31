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

import fetchMock from 'fetch-mock';
import { renderHook } from '@testing-library/react-hooks';
import { createWrapper, render } from 'spec/helpers/testing-library';
import { useDatasetMetadataBar } from './useDatasetMetadataBar';

test('renders dataset metadata bar', async () => {
  fetchMock.get('glob:*/api/v1/dataset/1', {
    result: {
      changed_on: '2023-01-26T12:06:58.733316',
      changed_on_humanized: 'a month ago',
      changed_by: { first_name: 'Han', last_name: 'Solo' },
      created_by: { first_name: 'Luke', last_name: 'Skywalker' },
      created_on: '2023-01-26T12:06:54.965034',
      created_on_humanized: 'a month ago',
      table_name: `This is dataset's name`,
      owners: [
        { first_name: 'John', last_name: 'Doe' },
        { first_name: 'Luke', last_name: 'Skywalker' },
      ],
      description: 'This is a dataset description',
    },
  });

  const { result, waitForValueToChange } = renderHook(
    () => useDatasetMetadataBar(1),
    {
      wrapper: createWrapper(),
    },
  );
  expect(result.current.status).toEqual('loading');
  await waitForValueToChange(() => result.current.status);
  expect(result.current.status).toEqual('complete');

  const { findByText, findAllByRole } = render(result.current.metadataBar);
  expect(await findByText(`This is dataset's name`)).toBeVisible();
  expect(await findByText('This is a dataset description')).toBeVisible();
  expect(await findByText('Luke Skywalker')).toBeVisible();
  expect(await findByText('a month ago')).toBeVisible();
  expect(await findAllByRole('img')).toHaveLength(4);
  fetchMock.restore();
});

test('renders dataset metadata bar without description and owners', async () => {
  fetchMock.get('glob:*/api/v1/dataset/1', {
    result: {
      changed_on: '2023-01-26T12:06:58.733316',
      changed_on_humanized: 'a month ago',
      created_on: '2023-01-26T12:06:54.965034',
      created_on_humanized: 'a month ago',
      table_name: `This is dataset's name`,
    },
  });

  const { result, waitForValueToChange } = renderHook(
    () => useDatasetMetadataBar(1),
    {
      wrapper: createWrapper(),
    },
  );
  expect(result.current.status).toEqual('loading');
  await waitForValueToChange(() => result.current.status);
  expect(result.current.status).toEqual('complete');

  const { findByText, queryByText, findAllByRole } = render(
    result.current.metadataBar,
  );
  expect(await findByText(`This is dataset's name`)).toBeVisible();
  expect(queryByText('This is a dataset description')).not.toBeInTheDocument();
  expect(await findByText('Not available')).toBeVisible();
  expect(await findByText('a month ago')).toBeVisible();
  expect(await findAllByRole('img')).toHaveLength(3);

  fetchMock.restore();
});

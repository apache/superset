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
import {
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import * as bootstrapDataModule from 'src/utils/getBootstrapData';
import {
  cleanupAsyncOperations,
  createProps,
  DATASOURCE_ENDPOINT,
  dismissDatasourceWarning,
  fastRender,
  setupDatasourceEditorMocks,
} from './DatasourceEditor.test.utils';

const enableDataFreshness = () => {
  const actual = bootstrapDataModule.default();
  return jest.spyOn(bootstrapDataModule, 'default').mockReturnValue({
    ...actual,
    common: {
      ...actual.common,
      conf: { ...actual.common.conf, DATA_FRESHNESS_ENABLED: true },
    },
  });
};

/** Pick an option from the dropdown of the select labelled `selectName`. */
const choose = async (option: string, selectName: string) => {
  await userEvent.click(
    await screen.findByRole('combobox', { name: selectName }),
  );
  const dropdowns = document.querySelectorAll('.ant-select-dropdown-list');
  const item = await waitFor(() =>
    within(dropdowns[dropdowns.length - 1] as HTMLElement).getByText(option),
  );
  await userEvent.click(item);
};

const lastExtra = (
  onChange: ReturnType<typeof createProps>['onChange'],
): Record<string, unknown> => {
  const { calls } = onChange.mock;
  return JSON.parse(calls[calls.length - 1][0].extra as string);
};

beforeEach(() => {
  fetchMock.get(DATASOURCE_ENDPOINT, [], { name: DATASOURCE_ENDPOINT });
  setupDatasourceEditorMocks();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await cleanupAsyncOperations();
  fetchMock.clearHistory().removeRoutes();
});

test('data freshness settings are hidden unless DATA_FRESHNESS_ENABLED', async () => {
  fastRender(createProps());
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

  await screen.findByText('Certification');
  expect(screen.queryByText('Data freshness')).not.toBeInTheDocument();
});

test('choosing a load timestamp column writes it into extra', async () => {
  enableDataFreshness();
  const testProps = createProps();
  testProps.datasource.extra = '{"warning_markdown": "careful"}';
  fastRender(testProps);
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

  await choose('Latest value of a column', 'Data freshness source');
  await choose('ds', 'Load timestamp column');

  await waitFor(() =>
    expect(lastExtra(testProps.onChange)).toEqual({
      warning_markdown: 'careful',
      freshness: { column: 'ds' },
    }),
  );
});

test('only time columns are offered as the load timestamp column', async () => {
  enableDataFreshness();
  fastRender(createProps());
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

  await choose('Latest value of a column', 'Data freshness source');
  await userEvent.click(
    await screen.findByRole('combobox', { name: 'Load timestamp column' }),
  );
  const dropdowns = document.querySelectorAll('.ant-select-dropdown-list');
  const list = dropdowns[dropdowns.length - 1] as HTMLElement;
  // `ds` is temporal; `gender` is a plain string column.
  expect(await within(list).findByText('ds')).toBeInTheDocument();
  expect(within(list).queryByText('gender')).not.toBeInTheDocument();
});

test('a stored setting is shown and can be cleared', async () => {
  enableDataFreshness();
  const testProps = createProps();
  testProps.datasource.extra = JSON.stringify({
    freshness: { column: 'ds', warn_after_minutes: 90 },
  });
  fastRender(testProps);
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

  expect(await screen.findByText('Load timestamp column')).toBeInTheDocument();
  expect(screen.getByDisplayValue('90')).toBeInTheDocument();

  await choose('Not set', 'Data freshness source');

  await waitFor(() => expect(lastExtra(testProps.onChange)).toEqual({}));
  expect(screen.queryByText('Load timestamp column')).not.toBeInTheDocument();
});

test('malformed Extra disables the data freshness controls', async () => {
  enableDataFreshness();
  const testProps = createProps();
  testProps.datasource.extra = '{"custom_key":';
  fastRender(testProps);
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

  expect(
    await screen.findByText('Fix the Extra JSON to edit data freshness'),
  ).toBeInTheDocument();
});

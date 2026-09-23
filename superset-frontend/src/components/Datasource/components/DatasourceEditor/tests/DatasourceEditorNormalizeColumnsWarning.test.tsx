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
import { useState } from 'react';
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import type { DatasetObject } from 'src/features/datasets/types';
import DatasourceEditor from '..';
import {
  createProps,
  DATASOURCE_ENDPOINT,
  setupDatasourceEditorMocks,
  cleanupAsyncOperations,
  fastRender,
  dismissDatasourceWarning,
  DatasourceEditorProps,
} from './DatasourceEditor.test.utils';

beforeEach(() => {
  fetchMock.get(DATASOURCE_ENDPOINT, [], { name: DATASOURCE_ENDPOINT });
  setupDatasourceEditorMocks();
});

afterEach(async () => {
  await cleanupAsyncOperations();
  fetchMock.clearHistory().removeRoutes();
});

const WARNING_TEXT = /will break/i;

const goToNormalizeColumnsCheckbox = async () => {
  await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
  const label = await screen.findByText('Normalize column names');
  const controlHeader = label.closest('.ControlHeader');
  if (!controlHeader) {
    throw new Error('Could not find the Normalize column names control');
  }
  return within(controlHeader as HTMLElement).getByRole('checkbox');
};

// DatasourceModal keeps a `currentDatasource` state that it updates on every
// `onChange` and passes back down as a new `datasource` prop object, echoing
// the in-progress edit back through the same prop DatasourceEditor was
// initialized from. Mirror that round-trip here rather than using a static
// prop, since a static prop can't catch a fix that (incorrectly) compares
// against the live prop instead of a baseline captured once on mount.
function DatasourceEditorWithParentEcho(props: DatasourceEditorProps) {
  const [datasource, setDatasource] = useState(props.datasource);
  return (
    <DatasourceEditor
      {...props}
      datasource={datasource}
      onChange={(data: DatasetObject, err?: unknown) => {
        setDatasource({ ...data });
        props.onChange(data, err);
      }}
    />
  );
}

const renderWithParentEcho = (renderProps: DatasourceEditorProps) =>
  render(<DatasourceEditorWithParentEcho {...renderProps} />, {
    useRedux: true,
    initialState: { common: { currencies: ['USD', 'GBP', 'EUR'] } },
    useRouter: true,
  });

test('warns immediately when normalize_columns is toggled on, before saving', async () => {
  const testProps = createProps();
  testProps.datasource.normalize_columns = false;
  fastRender(testProps);
  await dismissDatasourceWarning();

  const checkbox = await goToNormalizeColumnsCheckbox();
  expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();

  await userEvent.click(checkbox);

  expect(await screen.findByText(WARNING_TEXT)).toBeInTheDocument();
});

test('hides the warning again when normalize_columns is toggled back off', async () => {
  const testProps = createProps();
  testProps.datasource.normalize_columns = false;
  fastRender(testProps);
  await dismissDatasourceWarning();

  const checkbox = await goToNormalizeColumnsCheckbox();
  await userEvent.click(checkbox);
  expect(await screen.findByText(WARNING_TEXT)).toBeInTheDocument();

  await userEvent.click(checkbox);

  expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
});

test('does not warn when the dataset already has normalize_columns enabled', async () => {
  const testProps = createProps();
  testProps.datasource.normalize_columns = true;
  fastRender(testProps);
  await dismissDatasourceWarning();

  await goToNormalizeColumnsCheckbox();

  expect(screen.queryByText(WARNING_TEXT)).not.toBeInTheDocument();
});

test('keeps the warning visible after the parent echoes the toggle back down as a new datasource prop', async () => {
  const testProps = createProps();
  testProps.datasource.normalize_columns = false;
  renderWithParentEcho(testProps);
  await dismissDatasourceWarning();

  const checkbox = await goToNormalizeColumnsCheckbox();
  await userEvent.click(checkbox);

  // Wait until the echo has actually happened (the parent's onChange fired
  // with the toggled-on value) before asserting the warning survived it.
  await waitFor(() => {
    const [datasource] = testProps.onChange.mock.calls.at(-1) ?? [];
    expect(datasource?.normalize_columns).toBe(true);
  });

  expect(screen.getByText(WARNING_TEXT)).toBeInTheDocument();
});

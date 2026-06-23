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
import { screen, userEvent, waitFor } from 'spec/helpers/testing-library';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import {
  createProps,
  asyncRender,
  setupDatasourceEditorMocks,
  cleanupAsyncOperations,
} from './DatasourceEditor.test.utils';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const enableFlag = (on: boolean) =>
  jest
    .mocked(isFeatureEnabled)
    .mockImplementation(
      (flag: FeatureFlag) =>
        on && flag === FeatureFlag.DatasetPresentationTimezone,
    );

type WithDatabase = {
  database?: {
    id: number;
    backend?: string;
    supports_presentation_timezone?: boolean;
  };
};

const renderSettings = async (supportsZone: boolean) => {
  const props = createProps();
  const datasource = props.datasource as typeof props.datasource & WithDatabase;
  datasource.database = {
    ...datasource.database,
    id: 1,
    supports_presentation_timezone: supportsZone,
  };
  await asyncRender(props);
  userEvent.click(screen.getByRole('tab', { name: /settings/i }));
  return props;
};

beforeEach(() => {
  setupDatasourceEditorMocks();
  jest.clearAllMocks();
});

afterEach(async () => {
  await cleanupAsyncOperations();
  jest.mocked(isFeatureEnabled).mockReset();
});

test('hides the presentation time zone field when the flag is off', async () => {
  enableFlag(false);
  await renderSettings(true);
  expect(screen.queryByText('Presentation time zone')).not.toBeInTheDocument();
});

test('hides the field when the engine does not support it', async () => {
  enableFlag(true);
  await renderSettings(false);
  expect(screen.queryByText('Presentation time zone')).not.toBeInTheDocument();
});

test('shows the field, inert until enabled, then persists an IANA zone', async () => {
  enableFlag(true);
  const props = await renderSettings(true);

  // The label renders; the zone selector is hidden until the user opts in.
  const checkbox = await screen.findByRole('checkbox', {
    name: /presentation time zone/i,
  });
  expect(checkbox).not.toBeChecked();
  const comboboxesBefore = screen.queryAllByRole('combobox').length;

  // Opting in persists a concrete presentation default (never a silently-guessed
  // zone) and reveals both the presentation and the source zone selectors. The
  // source zone is shown defaulting to UTC but is not written until the operator
  // picks one (the backend treats an unset source as UTC).
  userEvent.click(checkbox);
  await waitFor(() => {
    const lastCall = (props.onChange as jest.Mock).mock.calls.at(-1);
    expect(lastCall?.[0].presentation_timezone).toBe('UTC');
  });
  await waitFor(() => {
    expect(screen.queryAllByRole('combobox').length).toBe(comboboxesBefore + 2);
  });

  // Clearing it returns the dataset to inert (null).
  userEvent.click(
    await screen.findByRole('checkbox', { name: /presentation time zone/i }),
  );
  await waitFor(() => {
    const lastCall = (props.onChange as jest.Mock).mock.calls.at(-1);
    expect(lastCall?.[0].presentation_timezone).toBeNull();
  });
});

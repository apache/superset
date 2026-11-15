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
import type { pages as pagesApi } from '@apache-superset/core';
import {
  FeatureFlag,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import { act, render, screen } from 'spec/helpers/testing-library';
import { pages } from 'src/core';
import ExtensionPage from './ExtensionPage';
import ExtensionsLoader from './ExtensionsLoader';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.MockedFunction<
  typeof isFeatureEnabled
>;

const PAGE = 'extensions.acme.reports.report';

const Report = ({ params }: pagesApi.PageProps) => (
  <p>Report {params.reportId}</p>
);

const finishLoading = async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [] },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.get>>);
  const infoSpy = jest.spyOn(logging, 'info').mockImplementation();
  await act(() => ExtensionsLoader.getInstance().initializeExtensions());
  getSpy.mockRestore();
  infoSpy.mockRestore();
};

beforeEach(() => {
  (ExtensionsLoader as unknown as { instance?: ExtensionsLoader }).instance =
    undefined;
  mockIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.EnableExtensions,
  );
});

test('renders the registered page with the params its endpoint passed', () => {
  const registration = pages.registerPage(PAGE, Report);

  render(<ExtensionPage id={PAGE} params={{ reportId: '42' }} />);

  expect(screen.getByText('Report 42')).toBeInTheDocument();
  registration.dispose();
});

test('waits for the extensions, then renders the page once it registers', () => {
  render(<ExtensionPage id={PAGE} params={{ reportId: '42' }} />);

  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByText('Report 42')).not.toBeInTheDocument();

  let registration = { dispose: () => {} };
  act(() => {
    registration = pages.registerPage(PAGE, Report);
  });

  expect(screen.getByText('Report 42')).toBeInTheDocument();
  registration.dispose();
});

test('says the page is unavailable when no extension registered it', async () => {
  render(<ExtensionPage id={PAGE} params={{}} />);

  await finishLoading();

  expect(
    screen.getByText(`The extension ${PAGE} could not be loaded.`),
  ).toBeInTheDocument();
});

test('says the page is unavailable while extensions are off', () => {
  mockIsFeatureEnabled.mockReturnValue(false);

  render(<ExtensionPage id={PAGE} params={{}} />);

  expect(
    screen.getByText(`The extension ${PAGE} could not be loaded.`),
  ).toBeInTheDocument();
});

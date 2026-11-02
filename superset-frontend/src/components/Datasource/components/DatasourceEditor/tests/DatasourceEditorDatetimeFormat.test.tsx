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
import { t } from '@apache-superset/core/translation';
import { screen, userEvent, within } from 'spec/helpers/testing-library';
import {
  createProps,
  DATASOURCE_ENDPOINT,
  setupDatasourceEditorMocks,
  cleanupAsyncOperations,
  fastRender,
  dismissDatasourceWarning,
} from './DatasourceEditor.test.utils';

// spec/helpers/shim.tsx replaces react-markdown and the rehype plugins with a
// stub that prints the raw source. These tests assert the rendered links, so
// they need the real markdown pipeline.
jest.mock('react-markdown', () => jest.requireActual('react-markdown'));
jest.mock('rehype-raw', () => jest.requireActual('rehype-raw'));
jest.mock('rehype-sanitize', () => jest.requireActual('rehype-sanitize'));

// Record every msgid the editor asks for, and still translate it.
jest.mock('@apache-superset/core/translation', () => {
  const actual = jest.requireActual('@apache-superset/core/translation');
  return { ...actual, t: jest.fn(actual.t) };
});

const PYTHON_URL =
  'https://docs.python.org/3/library/datetime.html#strftime-strptime-behavior';
const ISO_URL = 'https://en.wikipedia.org/wiki/ISO_8601';

// The five msgids the description used to be split into.
const OLD_FRAGMENTS = [
  'The pattern of timestamp format. For strings use ',
  'Python datetime string pattern',
  ' expression which needs to adhere to the ',
  'ISO 8601',
];

const EXPECTED_TEXT =
  'The pattern of timestamp format. For strings use Python datetime string ' +
  'pattern expression which needs to adhere to the ISO 8601 standard to ' +
  'ensure that the lexicographical ordering coincides with the ' +
  'chronological ordering. If the timestamp format does not adhere to the ' +
  'ISO 8601 standard you will need to define an expression and type for ' +
  'transforming the string into a date or timestamp. Note currently time ' +
  'zones are not supported. If time is stored in epoch format, put ' +
  'epoch_s, epoch_ms or epoch_us. If no pattern is specified we fall back ' +
  'to using the optional defaults on a per database/column name level via ' +
  'the extra parameter.';

const normalize = (text: string | null) =>
  (text ?? '').replace(/\s+/g, ' ').trim();

beforeEach(() => {
  fetchMock.get(DATASOURCE_ENDPOINT, [], { name: DATASOURCE_ENDPOINT });
  setupDatasourceEditorMocks();
  jest.mocked(t).mockClear();
});

afterEach(async () => {
  await cleanupAsyncOperations();
  fetchMock.clearHistory().removeRoutes();
});

const openFirstColumn = async () => {
  fastRender(createProps());
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByTestId('collection-tab-Columns'));
  const expandToggles = await screen.findAllByLabelText(/expand row/i);
  await userEvent.click(expandToggles[0]);
};

test('datetime format description renders as one sentence with Python 3 and ISO 8601 links', async () => {
  await openFirstColumn();

  const label = (await screen.findAllByText('Datetime format'))[0];
  const infoIcon = label.parentElement?.querySelector(
    '[aria-label="info-circle"]',
  );
  expect(infoIcon).toBeTruthy();
  await userEvent.hover(infoIcon as Element);

  const pythonLink = await screen.findByRole('link', {
    name: 'Python datetime string pattern',
  });
  const tooltip = pythonLink.closest('[role="tooltip"]') as HTMLElement;
  expect(tooltip).toBeTruthy();

  expect(normalize(tooltip.textContent)).toBe(EXPECTED_TEXT);
  expect(pythonLink).toHaveAttribute('href', PYTHON_URL);
  expect(
    within(tooltip).getByRole('link', { name: 'ISO 8601' }),
  ).toHaveAttribute('href', ISO_URL);
  expect(within(tooltip).getByText('epoch_s').tagName).toBe('CODE');
});

test('datetime format description is translated with one t() call', async () => {
  await openFirstColumn();
  await screen.findAllByText('Datetime format');

  const msgids = new Set(jest.mocked(t).mock.calls.map(([msgid]) => msgid));
  const sentences = [...msgids].filter(
    msgid => msgid.includes('%(python_url)s') && msgid.includes('%(iso_url)s'),
  );

  expect(sentences).toHaveLength(1);
  OLD_FRAGMENTS.forEach(fragment => expect(msgids.has(fragment)).toBe(false));
  expect(
    [...msgids].some(msgid => msgid.startsWith(' standard to ensure')),
  ).toBe(false);
});

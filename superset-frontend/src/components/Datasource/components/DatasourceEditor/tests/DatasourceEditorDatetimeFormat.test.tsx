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

const URLS: Record<string, string> = {
  python_url: PYTHON_URL,
  iso_url: ISO_URL,
};
const LINK = /\[([^\]]+)\]\(%\((\w+)\)s\)/g;
const CODE = /`([^`]+)`/g;

// The sentence msgid holds both URL placeholders. Reading it from the t()
// calls keeps the tests independent of the English wording.
const sentenceMsgid = () =>
  [...new Set(jest.mocked(t).mock.calls.map(([msgid]) => msgid))].filter(
    msgid => msgid.includes('%(python_url)s') && msgid.includes('%(iso_url)s'),
  );

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
  // One t() call holds the whole sentence, so translators can reorder it.
  expect(sentenceMsgid()).toHaveLength(1);
  const [msgid] = sentenceMsgid();

  const label = (await screen.findAllByText('Datetime format'))[0];
  const infoIcon = label.parentElement?.querySelector(
    '[aria-label="info-circle"]',
  );
  expect(infoIcon).toBeTruthy();
  await userEvent.hover(infoIcon as Element);

  const links = [...msgid.matchAll(LINK)];
  expect(links.map(([, , name]) => name).sort()).toEqual(
    Object.keys(URLS).sort(),
  );
  const firstLink = await screen.findByRole('link', { name: links[0][1] });
  const tooltip = firstLink.closest('[role="tooltip"]') as HTMLElement;
  expect(tooltip).toBeTruthy();

  // The whole sentence renders: link text and code text, without markup.
  const rendered = msgid.replace(LINK, '$1').replace(CODE, '$1');
  expect(normalize(tooltip.textContent)).toBe(normalize(rendered));
  links.forEach(([, text, name]) =>
    expect(within(tooltip).getByRole('link', { name: text })).toHaveAttribute(
      'href',
      URLS[name],
    ),
  );
  [...msgid.matchAll(CODE)].forEach(([, code]) =>
    expect(within(tooltip).getByText(code).tagName).toBe('CODE'),
  );
});

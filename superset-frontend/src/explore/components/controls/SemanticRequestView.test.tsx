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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import copyTextToClipboard from 'src/utils/copy';
import * as syntaxHighlighter from '@superset-ui/core/components/CodeSyntaxHighlighter';
import SemanticRequestView, {
  REQUEST_KIND_LANGUAGES,
} from './SemanticRequestView';

jest.mock('src/utils/copy', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve()),
}));

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test('copies the complete raw provider request including headers and whitespace', async () => {
  const requestText = '-- SQL\n SELECT  1;\n\n-- SQL\nSELECT\t2;\n';
  const { container } = render(
    <SemanticRequestView requestText={requestText} />,
    {
      useRedux: true,
    },
  );
  await waitFor(() =>
    expect(container.querySelector('pre')?.textContent).toBe(requestText),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
  const copyMock = jest.mocked(copyTextToClipboard);
  expect(copyMock).toHaveBeenCalledTimes(1);
  await expect(copyMock.mock.calls[0][0]()).resolves.toBe(requestText);
});

test.each(['SQL', 'sql', 'json'])(
  'uses the known %s kind only as a highlight hint',
  async kind => {
    const highlighter = jest.spyOn(syntaxHighlighter, 'default');
    const requestText = `-- ${kind}\n{ "unformatted" : 1 }\n\n-- other\nprovider text`;
    const { container } = render(
      <SemanticRequestView requestText={requestText} />,
      {
        useRedux: true,
      },
    );
    expect(highlighter).toHaveBeenCalledWith(
      expect.objectContaining({
        language: REQUEST_KIND_LANGUAGES.get(kind.toLowerCase()),
        children: requestText,
        showCopyButton: false,
      }),
      expect.anything(),
    );
    await waitFor(() =>
      expect(container.querySelector('pre')?.textContent).toBe(requestText),
    );
  },
);

test.each(['snowflake-sql', 'graphql', 'constructor', 'unknown'])(
  'renders unknown kind %s as plain verbatim text',
  kind => {
    const highlighter = jest.spyOn(syntaxHighlighter, 'default');
    const requestText = `-- ${kind}\n  query { field }\n\n-- SQL\nSELECT 1;\n`;
    const { container } = render(
      <SemanticRequestView requestText={requestText} />,
      {
        useRedux: true,
      },
    );
    expect(container.querySelector('pre')?.textContent).toBe(requestText);
    expect(container.querySelector('pre')?.children).toHaveLength(0);
    expect(highlighter).not.toHaveBeenCalled();
  },
);

test('does not interpret provider text without a first-line host header', () => {
  const highlighter = jest.spyOn(syntaxHighlighter, 'default');
  const requestText = 'SELECT  1;\n-- SQL\nSELECT 2;';
  const { container } = render(
    <SemanticRequestView requestText={requestText} />,
    {
      useRedux: true,
    },
  );
  expect(container.querySelector('pre')?.textContent).toBe(requestText);
  expect(highlighter).not.toHaveBeenCalled();
});

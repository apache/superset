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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import URLShortLinkButton from 'src/components/URLShortLinkButton';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';

const fakeUrl = 'http://fakeurl.com';

fetchMock.post('glob:*/r/shortner/', fakeUrl);

test('renders with default props', () => {
  render(<URLShortLinkButton />, { useRedux: true });
  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('renders overlay on click', async () => {
  render(<URLShortLinkButton />, { useRedux: true });
  userEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
});

test('obtains short url', async () => {
  render(<URLShortLinkButton />, { useRedux: true });
  userEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent(fakeUrl);
});

test('creates email anchor', async () => {
  const subject = 'Subject';
  const content = 'Content';

  render(<URLShortLinkButton emailSubject={subject} emailContent={content} />, {
    useRedux: true,
  });

  const href = `mailto:?Subject=${subject}%20&Body=${content}${fakeUrl}`;
  userEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('link')).toHaveAttribute('href', href);
});

test('renders error message on short url error', async () => {
  fetchMock.mock('glob:*/r/shortner/', 500, {
    overwriteRoutes: true,
  });

  render(
    <>
      <URLShortLinkButton />
      <ToastContainer />
    </>,
    { useRedux: true },
  );
  userEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});

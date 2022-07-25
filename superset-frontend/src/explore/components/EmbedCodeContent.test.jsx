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
import fetchMock from 'fetch-mock';
import { render, screen } from 'spec/helpers/testing-library';
import EmbedCodeContent from 'src/explore/components/EmbedCodeContent';

const url = 'http://localhost/explore/p/100';
fetchMock.post('glob:*/api/v1/explore/permalink', { url });

describe('EmbedCodeButton', () => {
  it('renders', () => {
    expect(React.isValidElement(<EmbedCodeContent />)).toBe(true);
  });

  it('returns correct embed code', async () => {
    render(<EmbedCodeContent />, { useRedux: true });
    expect(await screen.findByText('iframe', { exact: false })).toBeVisible();
    expect(await screen.findByText('/iframe', { exact: false })).toBeVisible();
    expect(
      await screen.findByText('width="600"', { exact: false }),
    ).toBeVisible();
    expect(
      await screen.findByText('height="400"', { exact: false }),
    ).toBeVisible();
    expect(
      await screen.findByText(`src="${url}?standalone=1&height=400"`, {
        exact: false,
      }),
    ).toBeVisible();
  });
});

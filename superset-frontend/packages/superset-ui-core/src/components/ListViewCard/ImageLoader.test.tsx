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
import { logging } from '@apache-superset/core/utils';

import { render, screen, waitFor } from '@superset-ui/core/spec';
import { SupersetClient } from '../../connection';
import { ImageLoader, type BackgroundPosition } from './ImageLoader';

global.URL.createObjectURL = jest.fn(() => '/local_url');
const blob = new Blob([], { type: 'image/png' });

beforeAll(() => {
  fetchMock.mockGlobal();
});

afterAll(() => {
  fetchMock.hardReset();
});

fetchMock.get(
  'glob:*/thumbnail',
  { body: blob, headers: { 'Content-Type': 'image/png' } },
  { name: 'thumbnail' },
);

describe('ImageLoader', () => {
  const defaultProps = {
    src: '/thumbnail',
    fallback: '/fallback',
    position: 'top' as BackgroundPosition,
  };

  const setup = (extraProps = {}) => {
    const props = { ...defaultProps, ...extraProps };
    return render(<ImageLoader {...props} />);
  };

  afterEach(() => fetchMock.clearHistory());

  test('is a valid element', async () => {
    setup();
    expect(await screen.findByTestId('image-loader')).toBeVisible();
  });

  test('fetches loads the image in the background', async () => {
    setup();
    expect(screen.getByTestId('image-loader')).toHaveAttribute(
      'src',
      '/fallback',
    );
    expect(await screen.findByTestId('image-loader')).toHaveAttribute(
      'src',
      '/local_url',
    );
    expect(fetchMock.callHistory.calls(/thumbnail/)).toHaveLength(1);
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  test('prefixes src with the configured app root', async () => {
    const prefixedUrl = 'http://localhost/analytics/app-root-thumbnail';
    fetchMock.get(
      prefixedUrl,
      { body: blob, headers: { 'Content-Type': 'image/png' } },
      { name: 'app-root-thumbnail' },
    );
    await SupersetClient.configure({
      protocol: 'http:',
      host: 'localhost',
      appRoot: '/analytics',
    }).init();

    try {
      setup({ src: '/app-root-thumbnail' });
      expect(await screen.findByTestId('image-loader')).toHaveAttribute(
        'src',
        '/local_url',
      );
      expect(fetchMock.callHistory.called(prefixedUrl)).toBe(true);
      expect(
        fetchMock.callHistory.calls(/app-root-thumbnail/).map(({ url }) => url),
      ).toEqual([prefixedUrl]);
    } finally {
      fetchMock.removeRoute('app-root-thumbnail');
      await SupersetClient.configure({
        protocol: 'http:',
        host: 'localhost',
      }).init();
    }
  });

  test('displays fallback image when SupersetClient is not configured', async () => {
    SupersetClient.reset();
    const loggingSpy = jest.spyOn(logging, 'error').mockImplementation();

    try {
      setup({ src: 'https://picsum.photos/seed/superset/300/200' });
      await waitFor(() => expect(loggingSpy).toHaveBeenCalled());
      expect(screen.getByTestId('image-loader')).toHaveAttribute(
        'src',
        '/fallback',
      );
      expect(fetchMock.callHistory.calls(/picsum/)).toHaveLength(0);
    } finally {
      loggingSpy.mockRestore();
      await SupersetClient.configure({
        protocol: 'http:',
        host: 'localhost',
      }).init();
    }
  });

  test('displays fallback image when response is not an image', async () => {
    fetchMock.once('glob:*/thumbnail2', {}, { name: 'thumbnail2' });

    setup({ src: 'glob:*/thumbnail2' });
    expect(screen.getByTestId('image-loader')).toHaveAttribute(
      'src',
      '/fallback',
    );
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(/thumbnail2/)).toHaveLength(1),
    );
    expect(await screen.findByTestId('image-loader')).toHaveAttribute(
      'src',
      '/fallback',
    );
  });
});

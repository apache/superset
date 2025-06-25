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

import ImageLoader, {
  BackgroundPosition,
} from 'src/components/ListViewCard/ImageLoader';
import { render, screen } from 'spec/helpers/testing-library';

global.URL.createObjectURL = jest.fn(() => '/local_url');
const blob = new Blob([], { type: 'image/png' });

fetchMock.get(
  '/thumbnail',
  { body: blob, headers: { 'Content-Type': 'image/png' } },
  {
    sendAsJson: false,
  },
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

  afterEach(() => fetchMock.resetHistory());

  it('is a valid element', async () => {
    setup();
    expect(await screen.findByTestId('image-loader')).toBeVisible();
  });

  it('fetches loads the image in the background', async () => {
    setup();
    expect(screen.getByTestId('image-loader')).toHaveAttribute(
      'src',
      '/fallback',
    );
    expect(fetchMock.calls(/thumbnail/)).toHaveLength(1);
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(await screen.findByTestId('image-loader')).toHaveAttribute(
      'src',
      '/local_url',
    );
  });

  it('displays fallback image when response is not an image', async () => {
    fetchMock.once('/thumbnail2', {});
    setup({ src: '/thumbnail2' });
    expect(screen.getByTestId('image-loader')).toHaveAttribute(
      'src',
      '/fallback',
    );
    expect(fetchMock.calls(/thumbnail2/)).toHaveLength(1);
    expect(await screen.findByTestId('image-loader')).toHaveAttribute(
      'src',
      '/fallback',
    );
  });
});

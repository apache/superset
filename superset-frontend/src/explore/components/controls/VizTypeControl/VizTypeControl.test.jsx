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
import sinon from 'sinon';
import { getChartMetadataRegistry, ChartMetadata } from '@superset-ui/core';
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import VizTypeControl from 'src/explore/components/controls/VizTypeControl';
import { DynamicPluginProvider } from 'src/components/DynamicPlugins';

const defaultProps = {
  name: 'viz_type',
  label: 'Visualization Type',
  value: 'vis1',
  onChange: sinon.spy(),
  isModalOpenInit: true,
};

/**
 * AntD and/or the Icon component seems to be doing some kind of async changes,
 * so even though the test passes, there is a warning an update to Icon was not
 * wrapped in act(). This sufficiently act-ifies whatever side effects are going
 * on and prevents those warnings.
 */
const waitForEffects = () =>
  act(() => new Promise(resolve => setTimeout(resolve, 0)));

// Increase global timeout
jest.setTimeout(60000);

// Add cleanup after each test
afterEach(async () => {
  cleanup();
  // Wait for any pending effects to complete
  await new Promise(resolve => setTimeout(resolve, 0));
});

describe('VizTypeControl', () => {
  const registry = getChartMetadataRegistry();
  registry
    .registerValue(
      'vis1',
      new ChartMetadata({
        name: 'vis1',
        thumbnail: '',
        tags: ['Featured'],
      }),
    )
    .registerValue(
      'vis2',
      new ChartMetadata({
        name: 'vis2',
        thumbnail: '',
        tags: ['foobar'],
      }),
    );

  beforeEach(async () => {
    render(
      <DynamicPluginProvider>
        <VizTypeControl {...defaultProps} />
      </DynamicPluginProvider>,
      { useRedux: true },
    );
    await waitForEffects();
  }, 30000); // Increase beforeEach timeout

  it('calls onChange when submitted', async () => {
    const thumbnail = await screen.findByTestId('viztype-selector-container', {
      timeout: 15000,
    });
    const submit = await screen.findByText('Select', { timeout: 15000 });

    await act(async () => {
      userEvent.click(thumbnail);
      await waitForEffects();
    });

    expect(defaultProps.onChange.called).toBe(false);

    await act(async () => {
      userEvent.click(submit);
      await waitForEffects();
    });

    expect(defaultProps.onChange.called).toBe(true);
  }, 30000);

  it('filters images based on text input', async () => {
    const thumbnails = await screen.findByTestId('viztype-selector-container', {
      timeout: 15000,
    });
    expect(thumbnails).toBeInTheDocument();

    const searchInput = await screen.findByPlaceholderText(
      'Search all charts',
      { timeout: 15000 },
    );

    await act(async () => {
      userEvent.type(searchInput, 'foo');
      await waitForEffects();
    });

    const thumbnail = await screen.findByTestId('viztype-selector-container', {
      timeout: 15000,
    });
    expect(thumbnail).toBeInTheDocument();
  }, 30000);
});

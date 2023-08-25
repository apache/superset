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
import { FeatureFlag } from '@superset-ui/core';
import userEvent from '@testing-library/user-event';
import { act, render, screen, within } from 'spec/helpers/testing-library';
import AddSliceCard from '.';

jest.mock('src/components/DynamicPlugins', () => ({
  usePluginContext: () => ({
    mountedPluginMetadata: { table: { name: 'Table' } },
  }),
}));

const mockedProps = {
  visType: 'table',
  sliceName: '-',
};

declare const global: {
  featureFlags: Record<string, boolean>;
};

test('do not render thumbnail if feature flag is not set', async () => {
  global.featureFlags = {
    [FeatureFlag.THUMBNAILS]: false,
  };

  await act(async () => {
    render(<AddSliceCard {...mockedProps} />);
  });

  expect(screen.queryByTestId('thumbnail')).not.toBeInTheDocument();
});

test('render thumbnail if feature flag is set', async () => {
  global.featureFlags = {
    [FeatureFlag.THUMBNAILS]: true,
  };

  await act(async () => {
    render(<AddSliceCard {...mockedProps} />);
  });

  expect(screen.queryByTestId('thumbnail')).toBeInTheDocument();
});

test('does not render the tooltip with anchors', async () => {
  const mock = jest
    .spyOn(React, 'useState')
    .mockImplementation(() => [true, jest.fn()]);
  render(
    <AddSliceCard
      {...mockedProps}
      datasourceUrl="http://test.com"
      datasourceName="datasource-name"
    />,
  );
  userEvent.hover(screen.getByRole('link', { name: 'datasource-name' }));
  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
  const tooltip = await screen.findByRole('tooltip');
  expect(within(tooltip).queryByRole('link')).not.toBeInTheDocument();
  mock.mockRestore();
});

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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { supersetTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import Popover from '.';

test('should render', () => {
  const { container } = render(<Popover />);
  expect(container).toBeInTheDocument();
});

test('should render a title when visible', () => {
  render(<Popover title="Popover title" visible />);
  expect(screen.getByText('Popover title')).toBeTruthy();
});

test('should render some content when visible', () => {
  render(<Popover content="Content sample" visible />);
  expect(screen.getByText('Content sample')).toBeTruthy();
});

test('it should not render a title or content when not visible', () => {
  render(<Popover content="Content sample" title="Popover title" />);
  const content = screen.queryByText('Content sample');
  const title = screen.queryByText('Popover title');
  expect(content).not.toBeInTheDocument();
  expect(title).not.toBeInTheDocument();
});

test('renders with icon child', async () => {
  render(
    <Popover content="Content sample" title="Popover title">
      <Icons.Alert>Click me</Icons.Alert>
    </Popover>,
  );
  expect(await screen.findByRole('img')).toBeInTheDocument();
});

test('fires an event when visibility is changed', async () => {
  const onVisibleChange = jest.fn();
  render(
    <Popover
      content="Content sample"
      title="Popover title"
      onVisibleChange={onVisibleChange}
    >
      <Button>Hover me</Button>
    </Popover>,
  );
  userEvent.hover(screen.getByRole('button'));
  await waitFor(() => expect(onVisibleChange).toHaveBeenCalledTimes(1));
});

test('renders with theme', () => {
  render(<Popover content="Content sample" title="Popover title" visible />);
  const title = screen.getByText('Popover title');
  expect(title).toHaveStyle({
    fontSize: supersetTheme.gridUnit * 3.5,
  });
});

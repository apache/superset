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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { supersetTheme } from '@superset-ui/core';
import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import { Tooltip } from '.';

test('starts hidden with default props', () => {
  render(
    <Tooltip title="Simple tooltip">
      <Button>Hover me</Button>
    </Tooltip>,
  );
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test('renders on hover', async () => {
  render(
    <Tooltip title="Simple tooltip">
      <Button>Hover me</Button>
    </Tooltip>,
  );
  userEvent.hover(screen.getByRole('button'));
  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
});

test('renders with theme', () => {
  render(
    <Tooltip title="Simple tooltip" defaultVisible>
      <Button>Hover me</Button>
    </Tooltip>,
  );
  const tooltip = screen.getByRole('tooltip');
  expect(tooltip).toHaveStyle({
    background: `${supersetTheme.colors.grayscale.dark2}e6`,
  });
  expect(tooltip.parentNode?.parentNode).toHaveStyle({
    lineHeight: 1.6,
    fontSize: 12,
  });
});

test('renders with icon child', async () => {
  render(
    <Tooltip title="Simple tooltip">
      <Icons.Alert>Hover me</Icons.Alert>
    </Tooltip>,
  );
  userEvent.hover(screen.getByRole('img'));
  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
});

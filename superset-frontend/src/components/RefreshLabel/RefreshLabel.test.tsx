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
import RefreshLabel from 'src/components/RefreshLabel';

test('renders with default props', async () => {
  render(<RefreshLabel tooltipContent="Tooltip" onClick={jest.fn()} />);
  const refresh = await screen.findByRole('button');
  expect(refresh).toBeInTheDocument();
  userEvent.hover(refresh);
});

test('renders tooltip on hover', async () => {
  const tooltipText = 'Tooltip';
  render(<RefreshLabel tooltipContent={tooltipText} onClick={jest.fn()} />);
  const refresh = screen.getByRole('button');
  userEvent.hover(refresh);
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent(tooltipText);
});

test('triggers on click event', async () => {
  const onClick = jest.fn();
  render(<RefreshLabel tooltipContent="Tooltip" onClick={onClick} />);
  const refresh = await screen.findByRole('button');
  userEvent.click(refresh);
  expect(onClick).toHaveBeenCalled();
});

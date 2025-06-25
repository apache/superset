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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import PopoverSection from 'src/components/PopoverSection';

test('renders with default props', async () => {
  render(
    <PopoverSection title="Title">
      <div role="form" />
    </PopoverSection>,
  );
  expect(await screen.findByRole('form')).toBeInTheDocument();
  expect((await screen.findAllByRole('img')).length).toBe(1);
});

test('renders tooltip icon', async () => {
  render(
    <PopoverSection title="Title" info="Tooltip">
      <div role="form" />
    </PopoverSection>,
  );
  expect((await screen.findAllByRole('img')).length).toBe(2);
});

test('renders a tooltip when hovered', async () => {
  render(
    <PopoverSection title="Title" info="Tooltip">
      <div role="form" />
    </PopoverSection>,
  );
  userEvent.hover(screen.getAllByRole('img')[0]);
  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
});

test('calls onSelect when clicked', async () => {
  const onSelect = jest.fn();
  render(
    <PopoverSection title="Title" onSelect={onSelect}>
      <div role="form" />
    </PopoverSection>,
  );
  userEvent.click(await screen.findByRole('img'));
  expect(onSelect).toHaveBeenCalled();
});

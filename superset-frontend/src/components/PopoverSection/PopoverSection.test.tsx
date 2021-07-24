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
import PopoverSection from 'src/components/PopoverSection';

test('renders with default props', () => {
  render(
    <PopoverSection title="Title">
      <div role="form" />
    </PopoverSection>,
  );
  expect(screen.getByRole('form')).toBeInTheDocument();
  expect(screen.getAllByRole('img').length).toBe(1);
});

test('renders tooltip icon', () => {
  render(
    <PopoverSection title="Title" info="Tooltip">
      <div role="form" />
    </PopoverSection>,
  );
  expect(screen.getAllByRole('img').length).toBe(2);
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

test('calls onSelect when clicked', () => {
  const onSelect = jest.fn();
  render(
    <PopoverSection title="Title" onSelect={onSelect}>
      <div role="form" />
    </PopoverSection>,
  );
  userEvent.click(screen.getByRole('img'));
  expect(onSelect).toHaveBeenCalled();
});

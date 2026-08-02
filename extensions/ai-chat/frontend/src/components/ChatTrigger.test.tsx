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
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chat } from '@apache-superset/core';
import { __testing } from '../../test/coreMock';
import ChatTrigger from './ChatTrigger';
import { requestActivity } from '../state/activity';

beforeEach(() => {
  __testing.reset();
  requestActivity.set(false);
});

test('opens and closes the chat through the public API', async () => {
  render(<ChatTrigger />);
  const button = screen.getByTestId('ai-chat-trigger');
  expect(button).toHaveAttribute('aria-label', 'Open AI assistant');
  expect(button).toHaveAttribute('aria-expanded', 'false');

  await userEvent.click(button);
  expect(chat.isOpen()).toBe(true);
  expect(button).toHaveAttribute('aria-label', 'Close AI assistant');
  expect(button).toHaveAttribute('aria-expanded', 'true');

  await userEvent.click(button);
  expect(chat.isOpen()).toBe(false);
});

test('reflects host-driven open state', () => {
  render(<ChatTrigger />);
  act(() => {
    chat.open();
  });
  expect(screen.getByTestId('ai-chat-trigger')).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  act(() => {
    chat.close();
  });
  expect(screen.getByTestId('ai-chat-trigger')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('shows an activity badge while a request is in flight', () => {
  const { container } = render(<ChatTrigger />);
  expect(container.querySelector('.ant-badge-dot')).toBeNull();
  act(() => {
    requestActivity.set(true);
  });
  expect(container.querySelector('.ant-badge-dot')).not.toBeNull();
});

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

import { createRef } from 'react';
import { render, fireEvent, screen } from '@superset-ui/core/spec';
import { MenuDotsDropdown, NoAnimationDropdown } from '.';

const props = {
  overlay: <div>Test Overlay</div>,
};

describe('MenuDotsDropdown', () => {
  test('renders a focusable, labeled button trigger', () => {
    render(<MenuDotsDropdown {...props} />);
    expect(screen.getByTestId('dropdown-trigger')).toEqual(
      screen.getByRole('button', { name: 'Actions' }),
    );
  });

  test('forwards a ref to the trigger so callers can focus it programmatically', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<MenuDotsDropdown {...props} ref={ref} />);
    ref.current?.focus();
    expect(screen.getByTestId('dropdown-trigger')).toHaveFocus();
  });

  test('opens the menu when activated with the keyboard', async () => {
    // Callers (e.g. the SQL Lab tab menu) open the dropdown on click, since
    // antd's default trigger is hover, which keyboard activation can't
    // reach.
    render(<MenuDotsDropdown {...props} trigger={['click']} />);
    const trigger = screen.getByTestId('dropdown-trigger');
    trigger.focus();
    // A native <button> converts an Enter keypress into a click once
    // activated, so we simulate that browser behavior directly since
    // jsdom does not implement it for us.
    fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });
    fireEvent.click(trigger);
    expect(await screen.findByText('Test Overlay')).toBeInTheDocument();
  });
});

describe('NoAnimationDropdown', () => {
  test('requires children', () => {
    expect(() => {
      // @ts-expect-error need to test the error case
      render(<NoAnimationDropdown {...props} />);
    }).toThrow();
  });

  test('renders its children', () => {
    render(
      <NoAnimationDropdown {...props}>
        <button type="button">Test Button</button>
      </NoAnimationDropdown>,
    );
    expect(screen.getByText('Test Button')).toBeInTheDocument();
  });

  test('calls onBlur when it loses focus', () => {
    const onBlur = jest.fn();
    render(
      <NoAnimationDropdown {...props} onBlur={onBlur}>
        <button type="button">Test Button</button>
      </NoAnimationDropdown>,
    );
    fireEvent.blur(screen.getByText('Test Button'));
    expect(onBlur).toHaveBeenCalled();
  });

  test('calls onKeyDown when a key is pressed', () => {
    const onKeyDown = jest.fn();
    render(
      <NoAnimationDropdown {...props} onKeyDown={onKeyDown}>
        <button type="button">Test Button</button>
      </NoAnimationDropdown>,
    );
    fireEvent.keyDown(screen.getByText('Test Button'));
    expect(onKeyDown).toHaveBeenCalled();
  });
});

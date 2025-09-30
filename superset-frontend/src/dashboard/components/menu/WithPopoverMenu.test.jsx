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
import { fireEvent, render } from 'spec/helpers/testing-library';

import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';

const props = {
  children: <div id="child" />,
  disableClick: false,
  menuItems: [<div id="menu1" />, <div id="menu2" />],
  onChangeFocus() {},
  shouldFocus: () => true, // needed for mock
  isFocused: false,
  editMode: false,
};

function setup(overrideProps) {
  return render(<WithPopoverMenu {...props} {...overrideProps} />);
}

test('should render a div with class "with-popover-menu"', () => {
  const { container } = setup();
  expect(container.querySelector('.with-popover-menu')).toBeInTheDocument();
});

test('should render the passed children', () => {
  const { container } = setup();
  expect(container.querySelector('#child')).toBeInTheDocument();
});

test('should focus on click in editMode', () => {
  const { container } = setup({ editMode: true });
  fireEvent.click(container.querySelector('.with-popover-menu'));
  expect(
    container.querySelector('.with-popover-menu--focused'),
  ).toBeInTheDocument();
});

test('should render menuItems when focused', () => {
  const { container } = setup({ editMode: true });
  expect(container.querySelector('#menu1')).not.toBeInTheDocument();
  expect(container.querySelector('#menu2')).not.toBeInTheDocument();

  fireEvent.click(container.querySelector('.with-popover-menu'));
  expect(container.querySelector('#menu1')).toBeInTheDocument();
  expect(container.querySelector('#menu2')).toBeInTheDocument();
});

test('should not focus when disableClick=true', () => {
  const { container } = setup({ disableClick: true, editMode: true });

  fireEvent.click(container.querySelector('.with-popover-menu'));
  expect(
    container.querySelector('.with-popover-menu--focused'),
  ).not.toBeInTheDocument();
});

test('should use the passed shouldFocus func to determine if it should focus', () => {
  const { container } = setup({ editMode: true, shouldFocus: () => false });
  expect(
    container.querySelector('.with-popover-menu--focused'),
  ).not.toBeInTheDocument();
  fireEvent.click(container.querySelector('.with-popover-menu'));
  expect(
    container.querySelector('.with-popover-menu--focused'),
  ).not.toBeInTheDocument();
});

test('should NOT stop event propagation when disableClick=true and not handling focus', () => {
  const onChangeFocus = jest.fn();
  const mockEvent = {
    target: document.createElement('div'),
    stopPropagation: jest.fn(),
  };

  const { container } = setup({
    editMode: true,
    disableClick: true,
    shouldFocus: () => false,
    onChangeFocus,
  });

  const menuComponent = container.querySelector('.with-popover-menu');
  fireEvent.click(menuComponent, mockEvent);

  expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
});

test('should stop event propagation when handling focus', () => {
  const onChangeFocus = jest.fn();
  let stopPropagationCalled = false;

  const { container } = setup({
    editMode: true,
    disableClick: false,
    shouldFocus: () => true,
    onChangeFocus,
  });

  const menuComponent = container.querySelector('.with-popover-menu');

  const clickEvent = new MouseEvent('click', { bubbles: true });
  const originalStopPropagation = clickEvent.stopPropagation;
  clickEvent.stopPropagation = function () {
    stopPropagationCalled = true;
    return originalStopPropagation.call(this);
  };

  menuComponent.dispatchEvent(clickEvent);

  expect(stopPropagationCalled).toBe(true);
  expect(onChangeFocus).toHaveBeenCalledWith(true);
});

test('should stop event propagation when handling unfocus', () => {
  const onChangeFocus = jest.fn();
  let stopPropagationCount = 0;

  const { container } = setup({
    editMode: true,
    disableClick: false,
    shouldFocus: () => true,
    onChangeFocus,
    isFocused: false,
  });

  const menuComponent = container.querySelector('.with-popover-menu');

  const focusEvent = new MouseEvent('click', { bubbles: true });
  focusEvent.stopPropagation = function () {
    stopPropagationCount += 1;
  };

  menuComponent.dispatchEvent(focusEvent);

  const unfocusEvent = new MouseEvent('click', { bubbles: true });
  unfocusEvent.stopPropagation = function () {
    stopPropagationCount += 1;
  };

  setup({
    editMode: true,
    disableClick: false,
    shouldFocus: () => false,
    onChangeFocus,
    isFocused: true,
  });

  const refocusedComponent = container.querySelector(
    '.with-popover-menu--focused',
  );

  if (refocusedComponent) {
    refocusedComponent.dispatchEvent(unfocusEvent);
  }

  expect(stopPropagationCount).toBeGreaterThan(0);
});

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

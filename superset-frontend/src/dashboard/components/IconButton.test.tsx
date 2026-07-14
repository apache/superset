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
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import IconButton from './IconButton';

const icon = <span data-test="fake-icon">icon</span>;

test('calls onClick when clicked and not disabled', () => {
  const onClick = jest.fn();
  render(<IconButton icon={icon} onClick={onClick} data-test="my-button" />);

  fireEvent.click(screen.getByTestId('my-button'));

  expect(onClick).toHaveBeenCalledTimes(1);
  // aria-disabled is only rendered when the `disabled` prop is set
  expect(screen.getByTestId('my-button')).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

test('does not call onClick and sets aria-disabled when disabled', () => {
  const onClick = jest.fn();
  render(
    <IconButton icon={icon} onClick={onClick} disabled data-test="my-button" />,
  );

  const button = screen.getByTestId('my-button');
  fireEvent.click(button);

  expect(onClick).not.toHaveBeenCalled();
  expect(button).toHaveAttribute('aria-disabled', 'true');
});

test('renders the provided label', () => {
  render(<IconButton icon={icon} onClick={jest.fn()} label="My Label" />);

  expect(screen.getByText('My Label')).toBeInTheDocument();
});

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
import ComponentHeaderControls from '.';

test('renders nothing when items is empty', () => {
  const { container } = render(<ComponentHeaderControls items={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test('renders the trigger when items are provided', () => {
  render(
    <ComponentHeaderControls
      items={[{ key: 'edit', label: 'Edit', onClick: () => {} }]}
    />,
  );
  expect(screen.getByTestId('dropdown-trigger')).toBeInTheDocument();
});

test('fires onClick when a menu item is selected', async () => {
  const onEdit = jest.fn();
  const onPreview = jest.fn();
  render(
    <ComponentHeaderControls
      items={[
        { key: 'edit', label: 'Edit', onClick: onEdit },
        { key: 'preview', label: 'Preview', onClick: onPreview },
      ]}
    />,
  );
  await userEvent.click(screen.getByTestId('dropdown-trigger'));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(onPreview).not.toHaveBeenCalled();
});

test('disabled items are still rendered but do not fire onClick', async () => {
  const onClick = jest.fn();
  render(
    <ComponentHeaderControls
      items={[{ key: 'gone', label: 'Gone', onClick, disabled: true }]}
    />,
  );
  await userEvent.click(screen.getByTestId('dropdown-trigger'));
  const item = await screen.findByRole('menuitem', { name: 'Gone' });
  await userEvent.click(item);
  expect(onClick).not.toHaveBeenCalled();
});

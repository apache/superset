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
import ActionCell, { appendDataToMenu } from './index';
import { exampleMenuOptions, exampleRow } from './fixtures';

test('renders with default props', async () => {
  const clickHandler = jest.fn();
  exampleMenuOptions[0].onClick = clickHandler;
  render(<ActionCell menuOptions={exampleMenuOptions} row={exampleRow} />);
  // Open the menu
  userEvent.click(await screen.findByTestId('dropdown-trigger'));
  // verify all of the menu items are being displayed
  exampleMenuOptions.forEach((item, index) => {
    expect(screen.getByText(item.label)).toBeInTheDocument();
    if (index === 0) {
      // verify the menu items' onClick gets invoked
      userEvent.click(screen.getByText(item.label));
    }
  });
  expect(clickHandler).toHaveBeenCalled();
});

/**
 * Validate that the appendDataToMenu utility function used within the
 * Action cell menu rendering works as expected
 */
test('appendDataToMenu utility', () => {
  exampleMenuOptions.forEach(item => expect(item?.row).toBeUndefined());
  const modifiedMenuOptions = appendDataToMenu(exampleMenuOptions, exampleRow);
  modifiedMenuOptions.forEach(item => expect(item?.row).toBeDefined());
});

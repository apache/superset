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
import { Select } from 'src/components';

test('renders with default props', () => {
  const ariaLabel = 'test';
  render(
    <Select
      ariaLabel={ariaLabel}
      options={[
        { label: 'A', value: 0 },
        { label: 'B', value: 1 },
      ]}
    />,
  );

  expect(screen.getByRole('combobox', { name: ariaLabel })).toBeInTheDocument();
});

/*
Tests for the sync version of the select:
- Opens the select without any data
- Makes a selection in single mode
- Makes multiple selections in multiple mode
- Changes the selected item in single mode
- Deselects an item in multiple mode
- Adds a header to the select
- Adds a new option if none is available and allowNewValue is true
- Does not add a new option if the option already exists
- Does not add a new option if allowNewValue is false
- Inverts the selection
- Sets a initial value in single mode
- Sets a initial value in multiple mode
- Searches for an item
- Displays the selected items first
- Searches for label or value
- Clear all the values

Tests for the async version of the select:
- Opens the select without any data
- Makes a selection in single mode
- Makes multiple selections in multiple mode
- Changes the selected item in single mode
- Deselects an item in multiple mode
- Adds a new option if none is available and allowNewValue is true
- Does not add a new option if the option already exists
- Does not add a new option if allowNewValue is false
- Sets a initial value in single mode
- Sets a initial value in multiple mode
- Searches for an item already loaded
- Searches for an item in a page not loaded
- Displays the loading indicator
- Fetches more data when scrolling and more data is available
- Doesn't fetch more data when no more data is available
- Requests the correct page and page size
- Fetches only after a search input is entered if fetchOnlyOnSearch is true
- Does not fetch data when rendering
- Fetches data when opening the select
- Displays an error message when an exception is thrown while fetching
- Does not fire a new request for the same search input
- Displays the selected items first
- Sets the page to zero when a new search is made
- Clear all the values
*/

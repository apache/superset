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
import { List } from '@superset-ui/core/components';
import CustomListItem from '.';

const renderItems = (selectable: boolean) =>
  render(
    <List>
      <CustomListItem selectable={selectable}>First item</CustomListItem>
      <CustomListItem selectable={selectable}>Second item</CustomListItem>
    </List>,
  );

test('renders its children inside list items', () => {
  renderItems(false);
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getByText('First item')).toBeInTheDocument();
  expect(screen.getByText('Second item')).toBeInTheDocument();
});

test('forwards its ref to the underlying element', () => {
  const ref = { current: null as HTMLDivElement | null };
  render(
    <List>
      <CustomListItem ref={ref} selectable={false}>
        Item
      </CustomListItem>
    </List>,
  );
  expect(ref.current).toBeInstanceOf(HTMLElement);
});

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
import { expectTruncatingTitle } from 'spec/helpers/listViewTitleCell';
import { ListViewTitleCell } from './TitleCell';

test('truncates a title link and keeps its attributes', () => {
  render(
    <ListViewTitleCell>
      <a href="/target" title="A long title" data-test="title-link">
        A long title
      </a>
    </ListViewTitleCell>,
  );

  const link = screen.getByTestId('title-link');
  expect(link).toHaveAttribute('title', 'A long title');
  expect(link).toHaveAttribute('href', '/target');
  expectTruncatingTitle(link);
});

test('truncates plain title text', () => {
  render(<ListViewTitleCell>Plain title</ListViewTitleCell>);

  expectTruncatingTitle(screen.getByText('Plain title'));
});

test('renders adornments around the title without letting them shrink', () => {
  render(
    <ListViewTitleCell
      leading={
        <>
          <span data-test="first-badge" />
          <span data-test="second-badge" />
        </>
      }
      trailing={<span data-test="trailing-tooltip" />}
    >
      <a href="/target">Title</a>
    </ListViewTitleCell>,
  );

  const title = screen.getByText('Title');
  const row = title.parentElement!.parentElement!;
  const children = Array.from(row.children);
  expect(children).toEqual([
    screen.getByTestId('first-badge'),
    screen.getByTestId('second-badge'),
    title.parentElement,
    screen.getByTestId('trailing-tooltip'),
  ]);
  expect(getComputedStyle(row).display).toBe('flex');
  for (const testId of ['first-badge', 'second-badge', 'trailing-tooltip']) {
    expect(getComputedStyle(screen.getByTestId(testId)).flexShrink).toBe('0');
  }
  expect(getComputedStyle(title.parentElement!).flexShrink).toBe('1');
  expectTruncatingTitle(title);
});

test('spaces icons in badges but leaves the icons inside tags alone', () => {
  render(
    <ListViewTitleCell
      leading={
        <span>
          <svg data-test="badge-icon" />
        </span>
      }
      trailing={
        <span className="ant-tag" data-test="status-tag">
          <svg data-test="tag-icon" />
        </span>
      }
    >
      Title
    </ListViewTitleCell>,
  );

  expect(getComputedStyle(screen.getByTestId('badge-icon')).marginRight).toBe(
    '4px',
  );
  expect(getComputedStyle(screen.getByTestId('tag-icon')).marginRight).not.toBe(
    '4px',
  );
  expect(getComputedStyle(screen.getByTestId('status-tag')).marginLeft).toBe(
    '8px',
  );
});

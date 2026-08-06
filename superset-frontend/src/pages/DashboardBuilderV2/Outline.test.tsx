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
import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import DashboardProvider from 'src/core/dashboard/DashboardProvider';
import BuildingBlockView from 'src/core/dashboard/BuildingBlockView';
import 'src/core/dashboard';
import Outline from './Outline';

const provider = DashboardProvider.getInstance();

/**
 * Which elements were scrolled to, in order. jsdom has no layout, so the call
 * is the only observable part of scrolling — what it was called on is what
 * says the right block was reached for.
 */
const scrolled: Element[] = [];

beforeEach(() => {
  provider.reset();
  scrolled.length = 0;
  Element.prototype.scrollIntoView = jest.fn(function record(this: Element) {
    scrolled.push(this);
  });
});

/** The outline next to the canvas it reaches into: the pairing under test. */
const mount = () =>
  render(
    <>
      <Outline />
      <BuildingBlockView nodeId={provider.getRoot().id} />
    </>,
  );

const addMarkdown = (content: string): string =>
  provider.addBuildingBlock(provider.getRoot().id, 0, {
    type: 'markdown',
    props: { content },
  });

test('an empty dashboard says so instead of showing an empty tree', () => {
  mount();

  expect(screen.getByTestId('outline-empty')).toBeInTheDocument();
});

test('a row is listed for every block, labelled by its content', () => {
  const id = addMarkdown('Revenue by region');
  mount();

  // Scoped to the row rather than looked for on the page: the block's own
  // header on the canvas carries the same name, by design, so a bare text
  // query would match twice and prove neither.
  expect(screen.getByRole('tree')).toBeInTheDocument();
  expect(screen.getByTestId(`outline-row-${id}`)).toHaveTextContent(
    'Revenue by region',
  );
});

test('choosing a row selects that block', async () => {
  const id = addMarkdown('Revenue by region');
  mount();

  await userEvent.click(screen.getByTestId(`outline-row-${id}`));

  expect(provider.getSelection()).toBe(id);
});

test('choosing a row brings its block into view on the canvas', async () => {
  const below = addMarkdown('Down the page');
  addMarkdown('Up the top');
  const { container } = mount();

  await userEvent.click(screen.getByTestId(`outline-row-${below}`));

  // The point of the outline is reaching blocks the canvas is worst at
  // offering — including one scrolled out of sight. Selecting it and leaving
  // it off screen marks a block the author cannot see.
  expect(scrolled).toEqual([
    container.querySelector(`[data-node-id="${below}"]`),
  ]);
});

test('the keyboard reaches a block the same way the pointer does', () => {
  const id = addMarkdown('Revenue by region');
  const { container } = mount();

  fireEvent.keyDown(screen.getByTestId(`outline-row-${id}`), { key: 'Enter' });

  expect(provider.getSelection()).toBe(id);
  expect(scrolled).toEqual([container.querySelector(`[data-node-id="${id}"]`)]);
});

test('a row whose block is not on screen still selects', async () => {
  // The outline can outlive the canvas it describes — rendered on its own
  // here, but equally a block behind a collapsed container. Selection is the
  // part that must not depend on finding an element to scroll.
  const id = addMarkdown('Revenue by region');
  render(<Outline />);

  await userEvent.click(screen.getByTestId(`outline-row-${id}`));

  expect(provider.getSelection()).toBe(id);
  expect(scrolled).toEqual([]);
});

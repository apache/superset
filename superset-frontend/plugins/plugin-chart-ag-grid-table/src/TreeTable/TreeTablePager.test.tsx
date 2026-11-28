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
import '@testing-library/jest-dom';
import { useState } from 'react';
import { act, render, screen, waitFor } from '@superset-ui/core/spec';
import userEvent from '@testing-library/user-event';
import { addTranslation } from '@apache-superset/core/translation';
import TreeTablePager, { TreeTablePagerProps } from './TreeTablePager';

function renderPager(extra: Partial<TreeTablePagerProps> = {}) {
  const onPageChange = jest.fn();
  const onPageSizeChange = jest.fn();
  const view = render(
    <div id="chart-id-0">
      <button type="button">Before</button>
      <TreeTablePager
        currentPage={0}
        pageSize={50}
        total={1284}
        sliceId={0}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        {...extra}
      />
    </div>,
  );
  return { ...view, onPageChange, onPageSizeChange };
}

/** The accessible name or text of the focused element, as the tests read it. */
const focusName = () => {
  const element = document.activeElement as HTMLElement;
  return (
    element.getAttribute('aria-label') ??
    element.getAttribute('title') ??
    element.textContent ??
    ''
  ).trim();
};

test('the select is named "Page Size:" and the total is formatted ("1 to 50 of 1,284")', () => {
  renderPager();
  expect(
    screen.getByRole('combobox', { name: 'Page Size:' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Page Size:')).toBeInTheDocument();
  expect(screen.getByText('1 to 50 of 1,284').tagName).toBe('LI');
  expect(screen.queryByText(/Page 1 of/)).toBeNull();
});

test('the translated range can reorder named placeholders', () => {
  const key = '%(start)s to %(end)s of %(total)s';
  addTranslation(key, ['%(total)s: %(end)s ← %(start)s']);
  try {
    renderPager({ total: 1100 });
    expect(screen.getByText('1,100: 50 ← 1')).toBeInTheDocument();
  } finally {
    addTranslation(key, [key]);
  }
});

test.each([0, 3])('zero rows read "0 to 0 of 0" on page %s', currentPage => {
  renderPager({ total: 0, currentPage });
  expect(screen.getByText('0 to 0 of 0')).toBeInTheDocument();
});

test('page start and end use the same integer formatter as the total', () => {
  renderPager({ currentPage: 20, total: 1284 });
  expect(screen.getByText('1,001 to 1,050 of 1,284')).toBeInTheDocument();
});

test('one page keeps the pager and its total (no hideOnSinglePage)', () => {
  renderPager({ total: 12 });
  expect(screen.getByText('1 to 12 of 12')).toBeInTheDocument();
  expect(screen.getByTitle('1')).toBeInTheDocument();
});

test('Tab order: select, then page numbers, the jump and Next; disabled Previous on page 1 has no tab stop', async () => {
  renderPager();
  screen.getByRole('button', { name: 'Before' }).focus();
  const order: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    await userEvent.tab();
    order.push(focusName());
  }
  expect(order).toEqual([
    'Page Size:',
    '1',
    '2',
    '3',
    'Next 3 Pages',
    '26',
    'Next Page',
  ]);
  expect(screen.getByTitle('Previous Page')).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByTitle('Previous Page')).not.toHaveAttribute('tabindex');
});

test('Enter on a page number, the jump, Next and Previous changes the page once each', async () => {
  const { onPageChange } = renderPager({ currentPage: 1 });
  screen.getByTitle('3').focus();
  await userEvent.keyboard('{Enter}');
  screen.getByTitle('Next Page').focus();
  await userEvent.keyboard('{Enter}');
  screen.getByTitle('Previous Page').focus();
  await userEvent.keyboard('{Enter}');
  screen.getByTitle('Next 3 Pages').focus();
  await userEvent.keyboard('{Enter}');
  expect(onPageChange.mock.calls).toEqual([[2], [2], [0], [4]]);
});

test('Space on a page number does nothing (platform pager: Enter only)', async () => {
  const { onPageChange } = renderPager();
  screen.getByTitle('2').focus();
  await userEvent.keyboard(' ');
  expect(onPageChange).not.toHaveBeenCalled();
});

test('the last page is reached through its number; Next is disabled there', async () => {
  const { onPageChange } = renderPager({ currentPage: 25 });
  expect(screen.getByTitle('Next Page')).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  screen.getByTitle('1').focus();
  await userEvent.keyboard('{Enter}');
  expect(onPageChange).toHaveBeenCalledWith(0);
});

test.each([20, 50])(
  'page size: ascending options with %i selected and a pick calls the size handler',
  async pageSize => {
    const { container, onPageSizeChange } = renderPager({ pageSize });
    await userEvent.click(screen.getByRole('combobox', { name: 'Page Size:' }));
    const options = await screen.findAllByRole('option');
    expect(options.map(option => Number(option.textContent))).toEqual([
      10, 20, 50, 100, 200,
    ]);
    expect(
      container
        .querySelector('#chart-id-0')
        ?.querySelector('.ant-select-dropdown'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByTitle('100'));
    expect(onPageSizeChange).toHaveBeenCalledWith(100);
  },
);

function Controlled({ total }: { total: number }) {
  const [page, setPage] = useState(0);
  return (
    <TreeTablePager
      currentPage={page}
      pageSize={50}
      total={total}
      sliceId={0}
      onPageChange={next => setTimeout(() => setPage(next), 20)}
      onPageSizeChange={() => {}}
    />
  );
}

test('RB8: after a keyboard page change focus stays on the page control used', async () => {
  render(<Controlled total={1284} />);
  const two = screen.getByTitle('2');
  two.focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(() =>
    expect(screen.getByTitle('2')).toHaveClass('ant-pagination-item-active'),
  );
  await act(() => new Promise(resolve => setTimeout(resolve, 30)));
  expect(document.activeElement).toBe(screen.getByTitle('2'));
});

test('RB8: when the control used goes away (Next on the last page turns disabled), the new current page takes focus', async () => {
  render(<Controlled total={120} />);
  screen.getByTitle('Next Page').focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(() =>
    expect(screen.getByTitle('2')).toHaveClass('ant-pagination-item-active'),
  );
  screen.getByTitle('Next Page').focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(() =>
    expect(screen.getByTitle('3')).toHaveClass('ant-pagination-item-active'),
  );
  // jsdom keeps focus on a control that lost its tab stop; a browser drops it
  // to the page, which blur() stands in for.
  const next = screen.getByTitle('Next Page');
  expect(document.activeElement).toBe(next);
  next.setAttribute('tabindex', '0');
  act(() => next.blur());
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByTitle('3')),
  );
});

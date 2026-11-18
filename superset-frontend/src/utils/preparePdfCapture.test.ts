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
import preparePdfCapture from './preparePdfCapture';

jest.mock('@apache-superset/core/translation', () => ({
  t: (str: string, ...args: unknown[]) =>
    args.reduce<string>((text, arg) => text.replace('%s', String(arg)), str),
}));

const buildTable = (rows: number, columns: number, withSpan = false) => {
  const root = document.createElement('div');
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (let c = 0; c < columns; c += 1) {
    const th = document.createElement('th');
    th.textContent = `col${c}`;
    if (withSpan && c === 0) th.colSpan = 2;
    head.appendChild(th);
  }
  const body = table.createTBody();
  for (let r = 0; r < rows; r += 1) {
    const row = body.insertRow();
    for (let c = 0; c < columns; c += 1) {
      row.insertCell().textContent = `r${r}c${c}`;
    }
  }
  root.appendChild(table);
  document.body.appendChild(root);
  return { root, table };
};

const setScrollSize = (
  element: HTMLElement,
  size: { scrollHeight: number; clientHeight: number },
) => {
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: size.scrollHeight,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: size.clientHeight,
  });
};

afterEach(() => {
  document.body.innerHTML = '';
});

test('opens a clipped scroll area while preparing and puts it back afterwards', () => {
  const root = document.createElement('div');
  const scrollBox = document.createElement('div');
  scrollBox.setAttribute('style', 'overflow: auto; height: 80px;');
  setScrollSize(scrollBox, { scrollHeight: 5000, clientHeight: 80 });
  root.appendChild(scrollBox);
  document.body.appendChild(root);

  const { restore } = preparePdfCapture(root);

  expect(scrollBox.style.getPropertyValue('overflow')).toBe('visible');
  expect(scrollBox.style.getPropertyValue('height')).toBe('auto');

  restore();

  expect(scrollBox.getAttribute('style')).toBe('overflow: auto; height: 80px;');
});

test('leaves scroll areas that clip nothing untouched', () => {
  const root = document.createElement('div');
  const box = document.createElement('div');
  box.setAttribute('style', 'overflow: auto; height: 80px;');
  setScrollSize(box, { scrollHeight: 80, clientHeight: 80 });
  root.appendChild(box);
  document.body.appendChild(root);

  preparePdfCapture(root);

  expect(box.getAttribute('style')).toBe('overflow: auto; height: 80px;');
});

test('hides rows and columns beyond the bounds and returns a warning saying so', () => {
  const { root, table } = buildTable(5, 4);

  const { warning } = preparePdfCapture(root, 2, 3);

  const bodyRows = Array.from(table.tBodies[0].rows);
  expect(bodyRows[1].style.display).toBe('');
  expect(bodyRows[2].style.display).toBe('none');
  expect(table.rows[0].cells[2].style.display).toBe('');
  expect(table.rows[0].cells[3].style.display).toBe('none');
  expect(bodyRows[0].cells[3].style.display).toBe('none');

  expect(warning).toBe(
    'The PDF shows 2 of 5 rows and 3 of 4 columns. Use CSV or Excel export to get all the data.',
  );
});

test('restores every hidden cell', () => {
  const { root, table } = buildTable(5, 4);
  const before = root.innerHTML;

  const { restore } = preparePdfCapture(root, 2, 3);
  restore();

  expect(root.innerHTML).toBe(before);
  expect(table.rows[1].cells[3].hasAttribute('style')).toBe(false);
});

test('returns no warning and hides nothing for a table within the bounds', () => {
  const { root } = buildTable(3, 3);

  const { warning } = preparePdfCapture(root, 10, 10);

  expect(root.querySelectorAll('[style*="display: none"]')).toHaveLength(0);
  expect(warning).toBeNull();
});

test('bounds only the rows when the table has merged header cells', () => {
  const { root, table } = buildTable(5, 4, true);

  const { warning } = preparePdfCapture(root, 2, 2);

  expect(table.tBodies[0].rows[2].style.display).toBe('none');
  expect(table.rows[0].cells[3].style.display).toBe('');
  expect(warning).toBe(
    'The PDF shows 2 of 5 rows. Use CSV or Excel export to get all the data.',
  );
});

test('also opens the parents of a clipped scroll area so they do not clip it again', () => {
  const root = document.createElement('div');
  const tile = document.createElement('div');
  tile.setAttribute('style', 'overflow: hidden; height: 68px;');
  const scrollBox = document.createElement('div');
  scrollBox.setAttribute('style', 'overflow: auto; height: 80px;');
  setScrollSize(scrollBox, { scrollHeight: 5000, clientHeight: 80 });
  tile.appendChild(scrollBox);
  root.appendChild(tile);
  document.body.appendChild(root);

  const { restore } = preparePdfCapture(root);

  expect(tile.style.getPropertyValue('overflow')).toBe('visible');
  expect(tile.style.getPropertyValue('height')).toBe('auto');

  restore();

  expect(tile.getAttribute('style')).toBe('overflow: hidden; height: 68px;');
});

test('shrinks a fixed-layout table by hiding the extra column definitions', () => {
  const { root, table } = buildTable(2, 4);
  const colgroup = document.createElement('colgroup');
  for (let c = 0; c < 4; c += 1)
    colgroup.appendChild(document.createElement('col'));
  table.prepend(colgroup);

  const { restore } = preparePdfCapture(root, 10, 2);

  const cols = Array.from(table.querySelectorAll('col'));
  expect(cols[1].style.display).toBe('');
  expect(cols[2].style.display).toBe('none');
  expect(table.style.getPropertyValue('width')).toBe('auto');

  restore();

  expect(table.hasAttribute('style')).toBe(false);
});

test('gives one warning for a header table split from its body table', () => {
  const root = document.createElement('div');
  const header = document.createElement('table');
  const headRow = header.createTHead().insertRow();
  const body = buildTable(3, 4).table;
  for (let c = 0; c < 4; c += 1) headRow.insertCell().textContent = `h${c}`;
  root.append(header, body.parentElement as HTMLElement);
  document.body.appendChild(root);

  const { warning } = preparePdfCapture(root, 10, 2);

  expect(warning).toBe(
    'The PDF shows 2 of 4 columns. Use CSV or Excel export to get all the data.',
  );
  expect(header.rows[0].cells[3].style.display).toBe('none');
});

test('gives tables a header and alternating rows that read well on paper, then restores them', () => {
  const { root, table } = buildTable(4, 2);
  const before = root.innerHTML;

  const { restore } = preparePdfCapture(root, 10, 10);

  const [header] = table.rows[0].cells;
  expect(header.style.getPropertyValue('font-weight')).toBe('600');
  expect(header.style.getPropertyValue('border-bottom')).toContain('2px solid');
  const rows = Array.from(table.tBodies[0].rows);
  expect(rows[0].cells[0].style.getPropertyValue('background-color')).not.toBe(
    rows[1].cells[0].style.getPropertyValue('background-color'),
  );
  expect(rows[1].cells[0].style.getPropertyValue('border-bottom')).toContain(
    '1px solid',
  );

  restore();

  expect(root.innerHTML).toBe(before);
});

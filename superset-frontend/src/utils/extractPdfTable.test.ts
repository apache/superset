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
import extractPdfTable from './extractPdfTable';

const tableRoot = (rows: number, columns: number) => {
  const root = document.createElement('div');
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (let c = 0; c < columns; c += 1) {
    head.appendChild(document.createElement('th')).textContent = ` col${c} `;
  }
  const body = table.createTBody();
  for (let r = 0; r < rows; r += 1) {
    const row = body.insertRow();
    for (let c = 0; c < columns; c += 1) {
      row.insertCell().textContent = `r${r}c${c}`;
    }
  }
  root.appendChild(table);
  return root;
};

test('reads the header and rows of a table chart as text', () => {
  const result = extractPdfTable(tableRoot(2, 2), 'My chart');

  expect(result?.table).toEqual({
    title: 'My chart',
    headers: ['col0', 'col1'],
    rows: [
      ['r0c0', 'r0c1'],
      ['r1c0', 'r1c1'],
    ],
  });
  expect(result?.totalRows).toBe(2);
  expect(result?.totalColumns).toBe(2);
});

test('reads no more than the bounds and reports the full size', () => {
  const result = extractPdfTable(tableRoot(5, 4), 'Big', 2, 3);

  expect(result?.table.rows).toHaveLength(2);
  expect(result?.table.headers).toHaveLength(3);
  expect(result?.table.rows[0]).toHaveLength(3);
  expect(result?.totalRows).toBe(5);
  expect(result?.totalColumns).toBe(4);
});

test('joins a header table split from its body table', () => {
  const root = document.createElement('div');
  const header = document.createElement('table');
  const headRow = header.createTHead().insertRow();
  headRow.appendChild(document.createElement('th')).textContent = 'a';
  const body = tableRoot(2, 1);
  body.querySelector('thead')?.remove();
  root.append(header, body);

  const result = extractPdfTable(root, 'Split');

  expect(result?.table.headers).toEqual(['a']);
  expect(result?.table.rows).toEqual([['r0c0'], ['r1c0']]);
});

const pictureCases: [string, () => HTMLElement][] = [
  [
    'a dashboard',
    () => {
      const root = tableRoot(2, 2);
      root.classList.add('dashboard');
      return root;
    },
  ],
  [
    'a chart drawn on a canvas',
    () => {
      const root = tableRoot(2, 2);
      root.appendChild(document.createElement('canvas'));
      return root;
    },
  ],
  [
    'several tables with rows',
    () => {
      const root = tableRoot(2, 2);
      root.appendChild(tableRoot(2, 2));
      return root;
    },
  ],
  [
    'merged header cells',
    () => {
      const root = tableRoot(2, 2);
      (root.querySelector('th') as HTMLTableCellElement).colSpan = 2;
      return root;
    },
  ],
];

test.each(pictureCases)(
  'leaves %s to the picture-based export',
  (_name, build) => {
    expect(extractPdfTable(build(), 'x')).toBeNull();
  },
);

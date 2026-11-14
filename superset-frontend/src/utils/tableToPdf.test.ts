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
import buildTablePdf, { canDrawInPdf, PDF_MAX_PAGES } from './tableToPdf';

const makeRows = (count: number, columns: number) =>
  Array.from({ length: count }, (_, row) =>
    Array.from({ length: columns }, (_, column) => `r${row}c${column}`),
  );
const makeHeaders = (columns: number) =>
  Array.from({ length: columns }, (_, column) => `col${column}`);

test('draws a small table whole on a single page', () => {
  const { doc, shownRows, shownColumns } = buildTablePdf({
    title: 'Small',
    headers: makeHeaders(3),
    rows: makeRows(5, 3),
  });

  expect(doc.getNumberOfPages()).toBe(1);
  expect(shownRows).toBe(5);
  expect(shownColumns).toBe(3);
});

test('fits a table of ordinary width entirely on the page width', () => {
  const { shownColumns } = buildTablePdf({
    title: 'Ordinary',
    headers: makeHeaders(10),
    rows: makeRows(5, 10),
  });

  expect(shownColumns).toBe(10);
});

test('continues a long table on further pages', () => {
  const { doc, shownRows } = buildTablePdf({
    title: 'Long',
    headers: makeHeaders(3),
    rows: makeRows(120, 3),
  });

  expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  expect(shownRows).toBe(120);
});

test('stops at the page limit and says how many rows it drew', () => {
  const { doc, shownRows } = buildTablePdf({
    title: 'Very long',
    headers: makeHeaders(3),
    rows: makeRows(2000, 3),
  });

  expect(doc.getNumberOfPages()).toBe(PDF_MAX_PAGES);
  expect(shownRows).toBeGreaterThan(0);
  expect(shownRows).toBeLessThan(2000);
});

test('drops the columns that cannot fit the page width instead of continuing on more pages', () => {
  const { doc, shownColumns } = buildTablePdf({
    title: 'Wide',
    headers: makeHeaders(40),
    rows: makeRows(3, 40),
  });

  expect(shownColumns).toBeGreaterThan(0);
  expect(shownColumns).toBeLessThan(40);
  expect(doc.getNumberOfPages()).toBe(1);
});

test('keeps the text in the file as text, not as a picture', () => {
  const { doc } = buildTablePdf({
    title: 'Selectable',
    headers: ['name'],
    rows: [['unique-cell-text']],
  });

  const content = String(doc.output());
  expect(content).toContain('unique-cell-text');
  expect(content).not.toContain('/Subtype /Image');
});

test('accepts Latin text and refuses text the PDF fonts cannot draw', () => {
  expect(
    canDrawInPdf({ title: 't', headers: ['Café'], rows: [['10 €']] }),
  ).toBe(true);
  expect(canDrawInPdf({ title: 't', headers: ['名前'], rows: [['x']] })).toBe(
    false,
  );
});

test('does not wrap text that fits the page width', () => {
  const longValue = 'E. Some college credit, no degree';
  const { doc } = buildTablePdf({
    title: 'No wrapping',
    headers: ['gender', 'age', 'Highest Degree Earned'],
    rows: [['Male', '36', longValue]],
  });

  expect(String(doc.output())).toContain(`(${longValue})`);
});

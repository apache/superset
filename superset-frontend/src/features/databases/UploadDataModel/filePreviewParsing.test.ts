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
import {
  buildPreview,
  decodeText,
  parseDelimitedText,
  PREVIEW_ROW_LIMIT,
} from './filePreviewParsing';

test('parseDelimitedText handles CRLF line endings and a trailing newline', () => {
  expect(parseDelimitedText('a,b\r\n1,2\r\n', ',')).toEqual([
    ['a', 'b'],
    ['1', '2'],
  ]);
});

test('parseDelimitedText keeps empty fields', () => {
  expect(parseDelimitedText('a,,c\n,,', ',')).toEqual([
    ['a', '', 'c'],
    ['', '', ''],
  ]);
});

test('parseDelimitedText treats a quote inside an unquoted field as literal', () => {
  expect(parseDelimitedText('5" pipe,x', ',')).toEqual([['5" pipe', 'x']]);
});

test('parseDelimitedText stops after maxRecords', () => {
  expect(parseDelimitedText('h\n1\n2\n3', ',', 2)).toEqual([['h'], ['1']]);
});

test('decodeText strips a UTF-8 byte order mark', () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x69, 0x64]);
  expect(decodeText(bytes.buffer)).toBe('id');
});

test('buildPreview names blank headers by position and caps rows', () => {
  const rows = [['id', ''], ...Array.from({ length: 150 }, (_, i) => [i, 'x'])];
  const { columns, data } = buildPreview(rows);
  expect(columns).toEqual(['id', 'col_1']);
  expect(data).toHaveLength(PREVIEW_ROW_LIMIT);
  expect(data[0]).toEqual({ '0': '0', '1': 'x' });
});

test('buildPreview keeps duplicate header names as separate columns', () => {
  const { columns, data } = buildPreview([
    ['x', 'x'],
    ['1', '2'],
  ]);
  expect(columns).toEqual(['x', 'x']);
  expect(data).toEqual([{ '0': '1', '1': '2' }]);
});

test('buildPreview returns nothing when the header row is past the data', () => {
  expect(buildPreview([['a'], ['1']], { headerRow: 5 })).toEqual({
    columns: [],
    data: [],
  });
});

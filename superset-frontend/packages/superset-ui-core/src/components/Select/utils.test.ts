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
import type { LabeledValue as AntdLabeledValue } from 'antd/es/select';
import {
  splitWithQuoteEscaping,
  stripSurroundingQuotes,
  makeQuoteAwareTokenizer,
  propertyComparator,
} from './utils';

test('stripSurroundingQuotes removes matching surrounding double quotes', () => {
  expect(stripSurroundingQuotes('"foo"')).toBe('foo');
});

test('stripSurroundingQuotes trims whitespace before stripping', () => {
  expect(stripSurroundingQuotes('  "foo"  ')).toBe('foo');
});

test('stripSurroundingQuotes leaves text untouched when only one side is quoted', () => {
  expect(stripSurroundingQuotes('"foo')).toBe('"foo');
  expect(stripSurroundingQuotes('foo"')).toBe('foo"');
});

test('stripSurroundingQuotes preserves quotes in the middle of the string', () => {
  expect(stripSurroundingQuotes('a"b"c')).toBe('a"b"c');
});

test('stripSurroundingQuotes returns an empty string for `""`', () => {
  expect(stripSurroundingQuotes('""')).toBe('');
});

test('stripSurroundingQuotes does not strip a single lone quote', () => {
  expect(stripSurroundingQuotes('"')).toBe('"');
});

test('stripSurroundingQuotes returns an empty string for empty/whitespace input', () => {
  expect(stripSurroundingQuotes('')).toBe('');
  expect(stripSurroundingQuotes('   ')).toBe('');
});

test('stripSurroundingQuotes unescapes doubled quotes when stripping', () => {
  expect(stripSurroundingQuotes('"Bob ""The Builder"", Inc"')).toBe(
    'Bob "The Builder", Inc',
  );
  expect(stripSurroundingQuotes('"a""b"')).toBe('a"b');
});

test('splitWithQuoteEscaping splits by separator and trims tokens', () => {
  expect(splitWithQuoteEscaping('a, b ,c', [','])).toEqual(['a', 'b', 'c']);
});

test('splitWithQuoteEscaping treats doubled quotes inside a quoted region as a literal quote', () => {
  expect(splitWithQuoteEscaping('"Bob ""The Builder"", Inc"', [','])).toEqual([
    'Bob "The Builder", Inc',
  ]);
  expect(splitWithQuoteEscaping('"a ""b""",c', [','])).toEqual(['a "b"', 'c']);
});

test('splitWithQuoteEscaping preserves separator characters inside double quotes', () => {
  expect(splitWithQuoteEscaping('"a, b",c', [','])).toEqual(['a, b', 'c']);
});

test('splitWithQuoteEscaping strips quote characters from the output tokens', () => {
  expect(splitWithQuoteEscaping('"foo","bar"', [','])).toEqual(['foo', 'bar']);
});

test('splitWithQuoteEscaping drops empty tokens from adjacent or edge separators', () => {
  expect(splitWithQuoteEscaping('a,,b', [','])).toEqual(['a', 'b']);
  expect(splitWithQuoteEscaping(',a,b,', [','])).toEqual(['a', 'b']);
});

test('splitWithQuoteEscaping treats unclosed quotes as opening a region that runs to end', () => {
  expect(splitWithQuoteEscaping('"a, b', [','])).toEqual(['a, b']);
});

test('splitWithQuoteEscaping returns the original text when no separator is present', () => {
  expect(splitWithQuoteEscaping('hello world', [','])).toEqual(['hello world']);
});

test('splitWithQuoteEscaping strips surrounding quotes when no separator is present', () => {
  expect(splitWithQuoteEscaping('"Canada"', [','])).toEqual(['Canada']);
  expect(splitWithQuoteEscaping('"Bob ""B"""', [','])).toEqual(['Bob "B"']);
});

test('splitWithQuoteEscaping uses the first separator from the list that appears in the text', () => {
  expect(splitWithQuoteEscaping('a;b,c', [',', ';'])).toEqual(['a;b', 'c']);
  expect(splitWithQuoteEscaping('a;b', [',', ';'])).toEqual(['a', 'b']);
});

test('splitWithQuoteEscaping supports multi-character separators', () => {
  expect(splitWithQuoteEscaping('a, b, c', [', '])).toEqual(['a', 'b', 'c']);
});

test('makeQuoteAwareTokenizer returns input unchanged while quotes are open', () => {
  const tokenize = makeQuoteAwareTokenizer([',']);
  expect(tokenize('"Australia, US')).toEqual(['"Australia, US']);
});

test('makeQuoteAwareTokenizer returns input unchanged when separators only appear inside quotes', () => {
  const tokenize = makeQuoteAwareTokenizer([',']);
  expect(tokenize('"Australia, US"')).toEqual(['"Australia, US"']);
});

test('makeQuoteAwareTokenizer returns input unchanged when no separator is present', () => {
  const tokenize = makeQuoteAwareTokenizer([',']);
  expect(tokenize('Australia')).toEqual(['Australia']);
});

test('makeQuoteAwareTokenizer splits on a trailing unquoted separator', () => {
  const tokenize = makeQuoteAwareTokenizer([',']);
  expect(tokenize('Australia,')).toEqual(['Australia']);
});

test('makeQuoteAwareTokenizer splits mixed quoted and unquoted values', () => {
  const tokenize = makeQuoteAwareTokenizer([',']);
  expect(tokenize('"Australia, Austria",Canada')).toEqual([
    'Australia, Austria',
    'Canada',
  ]);
});

test('makeQuoteAwareTokenizer detects any separator from the list outside quotes', () => {
  const tokenize = makeQuoteAwareTokenizer([',', '\n']);
  expect(tokenize('a\nb')).toEqual(['a', 'b']);
  expect(tokenize('"a\nb"')).toEqual(['"a\nb"']);
});

test('propertyComparator sorts string properties lexicographically', () => {
  const compare = propertyComparator('label');
  const ten = { label: '10' } as AntdLabeledValue;
  const two = { label: '2' } as AntdLabeledValue;
  const hundred = { label: '100' } as AntdLabeledValue;
  expect([ten, two, hundred].sort(compare)).toEqual([ten, hundred, two]);
});

test('propertyComparator sorts number properties numerically', () => {
  const compare = propertyComparator('value');
  const ten = { value: 10 } as unknown as AntdLabeledValue;
  const two = { value: 2 } as unknown as AntdLabeledValue;
  const hundred = { value: 100 } as unknown as AntdLabeledValue;
  expect([ten, two, hundred].sort(compare)).toEqual([two, ten, hundred]);
});

test('propertyComparator sorts bigint properties numerically, not lexicographically', () => {
  const compare = propertyComparator('value');
  const ten = { value: 10n } as unknown as AntdLabeledValue;
  const two = { value: 2n } as unknown as AntdLabeledValue;
  const hundred = { value: 100n } as unknown as AntdLabeledValue;
  expect([ten, two, hundred].sort(compare)).toEqual([two, ten, hundred]);
});

test('propertyComparator sorts diverging-digit-length bigint values numerically', () => {
  const compare = propertyComparator('value');
  const a = { value: 10000000000000002n } as unknown as AntdLabeledValue;
  const b = { value: 9000000000000001n } as unknown as AntdLabeledValue;
  const c = { value: 10000000000000001n } as unknown as AntdLabeledValue;
  expect([a, b, c].sort(compare)).toEqual([b, c, a]);
});

test('propertyComparator sorts mixed bigint and number properties numerically', () => {
  const compare = propertyComparator('value');
  const bigTen = { value: 10n } as unknown as AntdLabeledValue;
  const two = { value: 2 } as unknown as AntdLabeledValue;
  const bigHundred = { value: 100n } as unknown as AntdLabeledValue;
  expect([bigTen, two, bigHundred].sort(compare)).toEqual([
    two,
    bigTen,
    bigHundred,
  ]);
});

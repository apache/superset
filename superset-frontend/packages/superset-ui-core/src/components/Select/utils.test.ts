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
  splitWithQuoteEscaping,
  stripSurroundingQuotes,
  findLastUnquotedSeparatorIndex,
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

test('splitWithQuoteEscaping splits by separator and trims tokens', () => {
  expect(splitWithQuoteEscaping('a, b ,c', [','])).toEqual(['a', 'b', 'c']);
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

test('splitWithQuoteEscaping uses the first separator from the list that appears in the text', () => {
  expect(splitWithQuoteEscaping('a;b,c', [',', ';'])).toEqual(['a;b', 'c']);
  expect(splitWithQuoteEscaping('a;b', [',', ';'])).toEqual(['a', 'b']);
});

test('splitWithQuoteEscaping supports multi-character separators', () => {
  expect(splitWithQuoteEscaping('a, b, c', [', '])).toEqual(['a', 'b', 'c']);
});

test('findLastUnquotedSeparatorIndex returns the index of the last unquoted separator', () => {
  expect(findLastUnquotedSeparatorIndex('a,b,c', ',')).toBe(3);
});

test('findLastUnquotedSeparatorIndex ignores separators inside double quotes', () => {
  expect(findLastUnquotedSeparatorIndex('a,"b,c"', ',')).toBe(1);
  expect(findLastUnquotedSeparatorIndex('"a,b"', ',')).toBe(-1);
});

test('findLastUnquotedSeparatorIndex returns -1 when no separator is present', () => {
  expect(findLastUnquotedSeparatorIndex('abc', ',')).toBe(-1);
  expect(findLastUnquotedSeparatorIndex('', ',')).toBe(-1);
});

test('findLastUnquotedSeparatorIndex with unclosed quote keeps subsequent separators quoted', () => {
  expect(findLastUnquotedSeparatorIndex('a,"b,c', ',')).toBe(1);
});

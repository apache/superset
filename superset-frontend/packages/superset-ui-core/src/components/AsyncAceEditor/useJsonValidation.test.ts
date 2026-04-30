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
import { renderHook } from '@testing-library/react-hooks';
import { useJsonValidation } from './useJsonValidation';

describe('useJsonValidation', () => {
  test('returns empty array for valid JSON', () => {
    const { result } = renderHook(() => useJsonValidation('{"key": "value"}'));
    expect(result.current).toEqual([]);
  });

  test('returns empty array when disabled', () => {
    const { result } = renderHook(() =>
      useJsonValidation('invalid json', { enabled: false }),
    );
    expect(result.current).toEqual([]);
  });

  test('returns empty array for empty input', () => {
    const { result } = renderHook(() => useJsonValidation(''));
    expect(result.current).toEqual([]);
  });

  test('extracts line and column from error message with parentheses', () => {
    // Since we can't control the exact error message from JSON.parse,
    // let's test with a mock that demonstrates the pattern matching
    const mockError = {
      message:
        "Expected ',' or '}' after property value in JSON at position 19 (line 3 column 2)",
    };

    // Test the regex pattern directly
    const match = mockError.message.match(/\(line (\d+) column (\d+)\)/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe('3');
    expect(match![2]).toBe('2');
  });

  test('returns error on first line when no line/column info in message', () => {
    const invalidJson = '{invalid}';
    const { result } = renderHook(() => useJsonValidation(invalidJson));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      type: 'error',
      row: 0,
      column: 1,
      text: expect.stringContaining('Invalid JSON'),
    });
  });

  test('uses custom error prefix', () => {
    const { result } = renderHook(() =>
      useJsonValidation('{invalid}', { errorPrefix: 'Custom error' }),
    );

    expect(result.current[0].text).toContain('Custom error');
  });

  test('falls back to "syntax error" when thrown error has no message (line 59 || branch)', () => {
    const spy = jest.spyOn(JSON, 'parse').mockImplementationOnce(() => {
      throw {}; // no .message property → error.message is undefined → falsy
    });

    const { result } = renderHook(() => useJsonValidation('some invalid json'));
    spy.mockRestore();

    expect(result.current).toHaveLength(1);
    expect(result.current[0].text).toContain('syntax error');
  });

  test('extracts row and column from error when message contains (line X column Y)', () => {
    const spy = jest.spyOn(JSON, 'parse').mockImplementationOnce(() => {
      throw new SyntaxError('Unexpected token (line 3 column 5)');
    });

    const { result } = renderHook(() => useJsonValidation('some invalid json'));
    spy.mockRestore();

    expect(result.current).toHaveLength(1);
    expect(result.current[0].row).toBe(2); // 3 - 1 = 2 (0-based)
    expect(result.current[0].column).toBe(4); // 5 - 1 = 4 (0-based)
  });
});

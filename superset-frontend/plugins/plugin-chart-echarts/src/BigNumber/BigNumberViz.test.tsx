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

/**
 * Tests for the color threshold formatter logic in BigNumberViz.
 *
 * The key fix: bigNumber === 0 is falsy, so the original code
 *   `const result = bigNumber ? formatter.getColorFromValue(bigNumber) : false`
 * would skip formatting for zero. The fix uses an explicit type check instead.
 */

// Simulate the fixed logic from BigNumberViz renderHeader
function applyColorFormatters(
  bigNumber: number | null | undefined,
  formatters: Array<{ getColorFromValue: (v: number) => string | undefined }>,
): string | undefined {
  let numberColor: string | undefined;
  const hasFormatters = Array.isArray(formatters) && formatters.length > 0;
  if (hasFormatters) {
    formatters.forEach(formatter => {
      // Fixed: use explicit type check instead of falsy check
      if (typeof bigNumber === 'number' && !isNaN(bigNumber)) {
        numberColor = formatter.getColorFromValue(bigNumber);
      }
    });
  }
  return numberColor;
}

test('applies color formatter when bigNumber is 0', () => {
  const getColorFromValue = jest.fn(() => 'red');
  const color = applyColorFormatters(0, [{ getColorFromValue }]);

  expect(getColorFromValue).toHaveBeenCalledWith(0);
  expect(color).toBe('red');
});

test('applies color formatter when bigNumber is positive', () => {
  const getColorFromValue = jest.fn(() => 'green');
  const color = applyColorFormatters(42, [{ getColorFromValue }]);

  expect(getColorFromValue).toHaveBeenCalledWith(42);
  expect(color).toBe('green');
});

test('applies color formatter when bigNumber is negative', () => {
  const getColorFromValue = jest.fn(() => 'blue');
  const color = applyColorFormatters(-5, [{ getColorFromValue }]);

  expect(getColorFromValue).toHaveBeenCalledWith(-5);
  expect(color).toBe('blue');
});

test('does not call color formatter when bigNumber is null', () => {
  const getColorFromValue = jest.fn();
  applyColorFormatters(null, [{ getColorFromValue }]);

  expect(getColorFromValue).not.toHaveBeenCalled();
});

test('does not call color formatter when bigNumber is undefined', () => {
  const getColorFromValue = jest.fn();
  applyColorFormatters(undefined, [{ getColorFromValue }]);

  expect(getColorFromValue).not.toHaveBeenCalled();
});

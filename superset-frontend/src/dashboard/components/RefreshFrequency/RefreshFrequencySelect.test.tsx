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
  CUSTOM_REFRESH_FREQUENCY,
  getRefreshFrequencyOptions,
  getRefreshWarningMessage,
  REFRESH_FREQUENCY_OPTIONS,
  validateRefreshFrequency,
} from "./RefreshFrequencySelect";

test("validateRefreshFrequency treats millisecond refreshLimit as seconds", () => {
  const errors = validateRefreshFrequency(5, 10000);

  expect(errors[0]).toContain("10");
});

test("validateRefreshFrequency treats second refreshLimit as seconds", () => {
  const errors = validateRefreshFrequency(5, 10);

  expect(errors[0]).toContain("10");
});

test("getRefreshWarningMessage normalizes refreshLimit", () => {
  expect(getRefreshWarningMessage(5, 10000, "warn")).toBe("warn");
  expect(getRefreshWarningMessage(5, 10, "warn")).toBe("warn");
  expect(getRefreshWarningMessage(15, 10000, "warn")).toBeNull();
});

test("getRefreshFrequencyOptions honours the configured intervals", () => {
  const options = getRefreshFrequencyOptions([
    [0, "Don't refresh"],
    [600, "10 minutes"],
    [1800, "30 minutes"],
    [3600, "1 hour"],
  ]);

  expect(options).toEqual([
    { value: 0, label: "Don't refresh" },
    { value: 600, label: "10 minutes" },
    { value: 1800, label: "30 minutes" },
    { value: 3600, label: "1 hour" },
    { value: CUSTOM_REFRESH_FREQUENCY, label: "Custom" },
  ]);
});

test("getRefreshFrequencyOptions falls back to the built-in list when the config is absent", () => {
  expect(getRefreshFrequencyOptions(undefined)).toEqual(
    REFRESH_FREQUENCY_OPTIONS,
  );
  expect(getRefreshFrequencyOptions([])).toEqual(REFRESH_FREQUENCY_OPTIONS);
  expect(getRefreshFrequencyOptions("10 seconds")).toEqual(
    REFRESH_FREQUENCY_OPTIONS,
  );
});

test("getRefreshFrequencyOptions drops malformed entries instead of rendering them", () => {
  const options = getRefreshFrequencyOptions([
    [600],
    ["not-a-number", "Ten minutes"],
    [-5, "Negative"],
    [1800, "   "],
    [1800, null],
    [3600, "1 hour"],
  ]);

  expect(options).toEqual([
    { value: 3600, label: "1 hour" },
    { value: CUSTOM_REFRESH_FREQUENCY, label: "Custom" },
  ]);
});

test("getRefreshFrequencyOptions keeps configured labels verbatim, including untranslated ones", () => {
  const options = getRefreshFrequencyOptions([[600, "10 Minuten"]]);

  expect(options[0].label).toBe("10 Minuten");
});

test("getRefreshFrequencyOptions does not append a second Custom entry", () => {
  const options = getRefreshFrequencyOptions([
    [600, "10 minutes"],
    [CUSTOM_REFRESH_FREQUENCY, "Custom"],
  ]);

  expect(
    options.filter((option) => option.value === CUSTOM_REFRESH_FREQUENCY),
  ).toHaveLength(1);
});

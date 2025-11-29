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
  gregorianToPersian,
  isPersianLocale,
  isRTLLayout,
} from 'src/utils/persianCalendar';

const defaultDir = document.documentElement.dir;
const defaultLang = document.documentElement.lang;
const defaultNavigatorLanguage = navigator.language;
const defaultNavigatorLanguages = navigator.languages;

const setNavigatorLanguage = (language?: string, languages?: string[]) => {
  Object.defineProperty(window.navigator, 'language', {
    value: language,
    configurable: true,
  });
  Object.defineProperty(window.navigator, 'languages', {
    value: languages,
    configurable: true,
  });
};

afterEach(() => {
  document.documentElement.dir = defaultDir;
  document.documentElement.lang = defaultLang;
  setNavigatorLanguage(defaultNavigatorLanguage, defaultNavigatorLanguages);
});

test('gregorian dates map to correct Persian weekday names', () => {
  expect(gregorianToPersian(2024, 3, 31).weekday).toBe('یکشنبه');
  expect(gregorianToPersian(2024, 4, 1).weekday).toBe('دوشنبه');
});

test('detects RTL when document direction is rtl', () => {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'en-US';
  setNavigatorLanguage('en-US', ['en-US']);

  expect(isRTLLayout()).toBe(true);
});

test('detects Persian locale from navigator languages', () => {
  document.documentElement.dir = '';
  document.documentElement.lang = '';
  setNavigatorLanguage('fa-IR', ['fa-IR']);

  expect(isPersianLocale()).toBe(true);
  expect(isRTLLayout()).toBe(true);
});

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
import { analyzeCurrencyInData } from '../../src/currency-format/utils';

test('analyzeCurrencyInData returns currency code for single currency', () => {
  const data = [
    { currency_code: 'USD', value: 100 },
    { currency_code: 'usd', value: 200 },
  ];
  expect(analyzeCurrencyInData(data, 'currency_code')).toBe('USD');
});

test('analyzeCurrencyInData returns null for mixed or invalid data', () => {
  expect(analyzeCurrencyInData([], 'currency_code')).toBeNull();
  expect(analyzeCurrencyInData([{ c: 'USD' }], undefined)).toBeNull();
  expect(analyzeCurrencyInData([{ c: 'USD' }, { c: 'EUR' }], 'c')).toBeNull();
});

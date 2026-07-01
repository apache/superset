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

const mockSetCurrencyLocale = jest.fn();

// Stub the formatter registries so the test focuses on the currency-locale
// wiring without exercising real d3/Intl registry setup.
const chainableRegistry = () => {
  const registry: Record<string, jest.Mock> = {};
  ['setD3Format', 'registerValue', 'setDefaultKey'].forEach(method => {
    registry[method] = jest.fn(() => registry);
  });
  registry.d3Format = jest.fn() as unknown as jest.Mock;
  return registry;
};

jest.mock('@superset-ui/core', () => ({
  setCurrencyLocale: mockSetCurrencyLocale,
  getNumberFormatterRegistry: jest.fn(() => chainableRegistry()),
  getTimeFormatterRegistry: jest.fn(() => chainableRegistry()),
  getNumberFormatter: jest.fn(() => jest.fn()),
  createDurationFormatter: jest.fn(() => jest.fn()),
  createMemoryFormatter: jest.fn(() => jest.fn()),
  createSmartDateFormatter: jest.fn(() => jest.fn()),
  createSmartDateVerboseFormatter: jest.fn(() => jest.fn()),
  createSmartDateDetailedFormatter: jest.fn(() => jest.fn()),
  NumberFormats: { INTEGER: ',d', INTEGER_SIGNED: '+,d' },
  SMART_DATE_ID: 'smart_date',
  SMART_DATE_DETAILED_ID: 'smart_date_detailed',
  SMART_DATE_VERBOSE_ID: 'smart_date_verbose',
}));

async function runSetupFormatters(locale: string) {
  // Imported lazily so the jest.mock factory above is initialized first.
  const { default: setupFormatters } = await import('./setupFormatters');
  setupFormatters({}, {}, locale);
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('setupFormatters wires the deployment locale into the currency locale', async () => {
  await runSetupFormatters('fr-FR');

  expect(mockSetCurrencyLocale).toHaveBeenCalledWith('fr-FR');
});

test('setupFormatters forwards an underscore-formatted locale to setCurrencyLocale', async () => {
  // currencyLocale.setCurrencyLocale is responsible for canonicalizing the tag;
  // setupFormatters must forward it untouched.
  await runSetupFormatters('pt_BR');

  expect(mockSetCurrencyLocale).toHaveBeenCalledWith('pt_BR');
});

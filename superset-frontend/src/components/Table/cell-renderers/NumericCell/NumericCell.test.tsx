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
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import NumericCell, { CurrencyCode, LocaleCode, Style } from './index';

test('renders with French locale and Euro currency format', () => {
  render(
    <NumericCell
      value={5678943}
      locale={LocaleCode.fr}
      options={{
        style: Style.CURRENCY,
        currency: CurrencyCode.EUR,
      }}
    />,
  );
  expect(screen.getByText('5 678 943,00 €')).toBeInTheDocument();
});

test('renders with English US locale and USD currency format', () => {
  render(
    <NumericCell
      value={5678943}
      locale={LocaleCode.en_US}
      options={{
        style: Style.CURRENCY,
        currency: CurrencyCode.USD,
      }}
    />,
  );
  expect(screen.getByText('$5,678,943.00')).toBeInTheDocument();
});

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
import { TimeFormats } from '@superset-ui/core';
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import TimeCell from '.';

const DATE = Date.parse('2022-01-01');

test('renders with default format', async () => {
  render(<TimeCell value={DATE} />);
  expect(screen.getByText('2022-01-01 00:00:00')).toBeInTheDocument();
});

test('renders with custom format', async () => {
  render(<TimeCell value={DATE} format={TimeFormats.DATABASE_DATE} />);
  expect(screen.getByText('2022-01-01')).toBeInTheDocument();
});

test('renders with number', async () => {
  render(<TimeCell value={DATE.valueOf()} />);
  expect(screen.getByText('2022-01-01 00:00:00')).toBeInTheDocument();
});

test('renders with no value', async () => {
  render(<TimeCell />);
  expect(screen.getByText('N/A')).toBeInTheDocument();
});

test('renders with invalid date format', async () => {
  render(<TimeCell format="aaa-bbb-ccc" value={DATE} />);
  expect(screen.getByText('aaa-bbb-ccc')).toBeInTheDocument();
});

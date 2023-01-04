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
import userEvent from '@testing-library/user-event';
import { UrlLinkPopoverContent } from './UrlLinkPopoverContent';

test('Should render', () => {
  render(<UrlLinkPopoverContent columns={[]} onChange={() => {}} />);
  expect(screen.getByText('link column name')).toBeInTheDocument();
  expect(screen.getByText('link text')).toBeInTheDocument();
  expect(screen.getByText('link schema')).toBeInTheDocument();
  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('check form rule on apply', async () => {
  render(<UrlLinkPopoverContent columns={[]} onChange={() => {}} />);
  userEvent.click(screen.getByRole('button'));
  await new Promise(r => setTimeout(r, 1000));
  expect(screen.getAllByText('Required').length).toEqual(3);
});

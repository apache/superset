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
import CertifiedIcon from 'src/components/CertifiedIcon';

test('renders with default props', () => {
  render(<CertifiedIcon />);
  expect(screen.getByRole('img')).toBeInTheDocument();
});

test('renders a tooltip when hovered', async () => {
  render(<CertifiedIcon />);
  userEvent.hover(screen.getByRole('img'));
  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
});

test('renders with certified by', async () => {
  const certifiedBy = 'Trusted Authority';
  render(<CertifiedIcon certifiedBy={certifiedBy} />);
  userEvent.hover(screen.getByRole('img'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent(certifiedBy);
});

test('renders with details', async () => {
  const details = 'All requirements have been met.';
  render(<CertifiedIcon details={details} />);
  userEvent.hover(screen.getByRole('img'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent(details);
});

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
import { GenericLink } from './GenericLink';

test('renders', () => {
  render(<GenericLink to="/explore">Link to Explore</GenericLink>, {
    useRouter: true,
  });
  expect(screen.getByText('Link to Explore')).toBeVisible();
});

test('navigates to internal URL', () => {
  render(<GenericLink to="/explore">Link to Explore</GenericLink>, {
    useRouter: true,
  });
  const internalLink = screen.getByTestId('internal-link');
  expect(internalLink).toHaveAttribute('href', '/explore');
});

test('navigates to external URL', () => {
  render(
    <GenericLink to="https://superset.apache.org/">
      Link to external website
    </GenericLink>,
    { useRouter: true },
  );
  const externalLink = screen.getByTestId('external-link');
  expect(externalLink).toHaveAttribute('href', 'https://superset.apache.org/');
});

test('navigates to external URL without host', () => {
  render(
    <GenericLink to="superset.apache.org/">
      Link to external website
    </GenericLink>,
    { useRouter: true },
  );
  const externalLink = screen.getByTestId('external-link');
  expect(externalLink).toHaveAttribute('href', '//superset.apache.org/');
});

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
import CrossLinks, { CrossLinksProps } from './CrossLinks';

const mockedProps = {
  crossLinks: [
    {
      id: 1,
      title: 'Test dashboard',
    },
    {
      id: 2,
      title: 'Test dashboard 2',
    },
    {
      id: 3,
      title: 'Test dashboard 3',
    },
    {
      id: 4,
      title: 'Test dashboard 4',
    },
  ],
};

function setup(overrideProps: CrossLinksProps | {} = {}) {
  return render(<CrossLinks {...mockedProps} {...overrideProps} />, {
    useRouter: true,
  });
}

test('should render', () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();
});

test('should not render links', () => {
  setup({
    crossLinks: [],
  });
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test('should render the link with just one item', () => {
  setup({
    crossLinks: [
      {
        id: 1,
        title: 'Test dashboard',
      },
    ],
  });
  expect(screen.getByText('Test dashboard')).toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    `/superset/dashboard/1`,
  );
});

test('should render a custom prefix link', () => {
  setup({
    crossLinks: [
      {
        id: 1,
        title: 'Test dashboard',
      },
    ],
    linkPrefix: '/custom/dashboard/',
  });
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    `/custom/dashboard/1`,
  );
});

test('should render multiple links', () => {
  setup();
  expect(screen.getAllByRole('link')).toHaveLength(4);
});

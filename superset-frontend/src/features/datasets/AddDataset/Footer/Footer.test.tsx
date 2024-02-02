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
import Footer from 'src/features/datasets/AddDataset/Footer';

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

const mockedProps = {
  url: 'realwebsite.com',
};

const mockPropsWithDataset = {
  url: 'realwebsite.com',
  datasetObject: {
    database: {
      id: '1',
      database_name: 'examples',
    },
    owners: [1, 2, 3],
    schema: 'public',
    dataset_name: 'Untitled',
    table_name: 'real_info',
  },
  hasColumns: true,
};

describe('Footer', () => {
  test('renders a Footer with a cancel button and a disabled create button', () => {
    render(<Footer {...mockedProps} />, { useRedux: true });

    const saveButton = screen.getByRole('button', {
      name: /Cancel/i,
    });

    const createButton = screen.getByRole('button', {
      name: /Create/i,
    });

    expect(saveButton).toBeVisible();
    expect(createButton).toBeDisabled();
  });

  test('renders a Create Dataset button when a table is selected', () => {
    render(<Footer {...mockPropsWithDataset} />, { useRedux: true });

    const createButton = screen.getByRole('button', {
      name: /Create/i,
    });

    expect(createButton).toBeEnabled();
  });

  test('create button becomes disabled when table already has a dataset', () => {
    render(<Footer datasets={['real_info']} {...mockPropsWithDataset} />, {
      useRedux: true,
    });

    const createButton = screen.getByRole('button', {
      name: /Create/i,
    });

    expect(createButton).toBeDisabled();
  });
});

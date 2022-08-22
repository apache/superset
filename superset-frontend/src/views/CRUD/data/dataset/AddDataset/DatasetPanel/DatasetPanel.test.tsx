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
import DatasetPanel from 'src/views/CRUD/data/dataset/AddDataset/DatasetPanel';

describe('DatasetPanel', () => {
  it('renders a blank state DatasetPanel', () => {
    render(<DatasetPanel />);

    const blankDatasetImg = screen.getByRole('img', { name: /empty/i });
    const blankDatasetTitle = screen.getByText(/select dataset source/i);
    const blankDatasetDescription = screen.getByText(
      /datasets can be created from database tables or sql queries\. select a database table to the left or to open sql lab\. from there you can save the query as a dataset\./i,
    );
    const sqlLabLink = screen.getByRole('button', {
      name: /create dataset from sql query/i,
    });

    expect(blankDatasetImg).toBeVisible();
    expect(blankDatasetTitle).toBeVisible();
    expect(blankDatasetDescription).toBeVisible();
    expect(sqlLabLink).toBeVisible();
  });
});

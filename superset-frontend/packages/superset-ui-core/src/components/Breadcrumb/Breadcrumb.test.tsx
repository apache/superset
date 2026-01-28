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
import { render, screen } from '@superset-ui/core/spec';
import '@testing-library/jest-dom';
import { Breadcrumb } from '.';

describe('Breadcrumb Component', () => {
  it('renders breadcrumb items correctly', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item>Home</Breadcrumb.Item>
        <Breadcrumb.Item>Library</Breadcrumb.Item>
        <Breadcrumb.Item>Data</Breadcrumb.Item>
      </Breadcrumb>,
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();

    const separators = screen.getAllByText('/');
    expect(separators.length).toBe(2);
  });
});

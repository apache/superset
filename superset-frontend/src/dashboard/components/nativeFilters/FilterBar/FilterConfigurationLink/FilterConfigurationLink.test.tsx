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
import FilterConfigurationLink from '.';

test('should render', () => {
  const { container } = render(
    <FilterConfigurationLink>Config link</FilterConfigurationLink>,
    {
      useRedux: true,
    },
  );
  expect(container).toBeInTheDocument();
});

test('should render the config link text', () => {
  render(<FilterConfigurationLink>Config link</FilterConfigurationLink>, {
    useRedux: true,
  });
  expect(screen.getByText('Config link')).toBeInTheDocument();
});

test('should render the modal on click', () => {
  render(<FilterConfigurationLink>Config link</FilterConfigurationLink>, {
    useRedux: true,
  });
  const configLink = screen.getByText('Config link');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  userEvent.click(configLink);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

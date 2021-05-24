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
import { MainNav as Menu } from 'src/common/components';
import LanguagePicker from './LanguagePicker';

const mockedProps = {
  locale: 'en',
  languages: {
    en: {
      flag: 'us',
      name: 'English',
      url: '/lang/en',
    },
    it: {
      flag: 'it',
      name: 'Italian',
      url: '/lang/it',
    },
  },
};

test('should render', () => {
  const { container } = render(
    <Menu>
      <LanguagePicker {...mockedProps} />
    </Menu>,
  );
  expect(container).toBeInTheDocument();
});

test('should render the language picker', () => {
  render(
    <Menu>
      <LanguagePicker {...mockedProps} />
    </Menu>,
  );
  expect(screen.getByLabelText('Languages')).toBeInTheDocument();
});

test('should render the items', async () => {
  render(
    <Menu>
      <LanguagePicker {...mockedProps} />
    </Menu>,
  );
  userEvent.hover(screen.getByRole('button'));
  expect(await screen.findByText('English')).toBeInTheDocument();
  expect(await screen.findByText('Italian')).toBeInTheDocument();
});

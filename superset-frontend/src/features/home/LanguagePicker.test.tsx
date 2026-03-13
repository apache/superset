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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { Menu } from '@superset-ui/core/components/Menu';
import type { DirectionType } from 'antd/es/config-provider';
import { useLanguageMenuItems } from './LanguagePicker';

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
  setDirection: jest.fn(),
};

const TestLanguagePicker = ({
  locale,
  languages,
  setDirection,
}: {
  locale: string;
  languages: typeof mockedProps.languages;
  setDirection: (dir: DirectionType) => void;
}) => {
  const languageMenuItem = useLanguageMenuItems({
    locale,
    languages,
    setDirection,
  });

  return (
    <Menu aria-label="Languages" items={[languageMenuItem]} mode="horizontal" />
  );
};

test('should render', async () => {
  const { container } = render(<TestLanguagePicker {...mockedProps} />, {
    useRouter: true,
  });
  expect(await screen.findByRole('menu')).toBeInTheDocument();
  expect(container).toBeInTheDocument();
});

test('should render the language picker', () => {
  render(<TestLanguagePicker {...mockedProps} />, {
    useRouter: true,
  });
  expect(screen.getByRole('menu', { name: 'Languages' })).toBeInTheDocument();
});

test('should render the items', async () => {
  render(<TestLanguagePicker {...mockedProps} />, {
    useRouter: true,
  });
  userEvent.hover(screen.getByRole('menuitem'));
  expect(await screen.findByText('English')).toBeInTheDocument();
  expect(await screen.findByText('Italian')).toBeInTheDocument();
});

test('should call setDirection with ltr for English locale', () => {
  const setDirection = jest.fn();
  render(
    <TestLanguagePicker {...mockedProps} setDirection={setDirection} />,
    { useRouter: true },
  );
  expect(setDirection).toHaveBeenCalledWith('ltr');
});

test('should call setDirection with rtl for Arabic locale', () => {
  const setDirection = jest.fn();
  const languages = {
    ...mockedProps.languages,
    ar: { flag: 'sa', name: 'Arabic', url: '/lang/ar' },
  };
  render(
    <TestLanguagePicker
      locale="ar"
      languages={languages}
      setDirection={setDirection}
    />,
    { useRouter: true },
  );
  expect(setDirection).toHaveBeenCalledWith('rtl');
});

test('should call setDirection with rtl for Farsi locale', () => {
  const setDirection = jest.fn();
  const languages = {
    ...mockedProps.languages,
    fa: { flag: 'ir', name: 'Farsi', url: '/lang/fa' },
  };
  render(
    <TestLanguagePicker
      locale="fa"
      languages={languages}
      setDirection={setDirection}
    />,
    { useRouter: true },
  );
  expect(setDirection).toHaveBeenCalledWith('rtl');
});

test('should call setDirection with rtl for locale with region code', () => {
  const setDirection = jest.fn();
  const languages = {
    ...mockedProps.languages,
    'ar-SA': { flag: 'sa', name: 'Arabic (Saudi)', url: '/lang/ar-SA' },
  };
  render(
    <TestLanguagePicker
      locale="ar-SA"
      languages={languages}
      setDirection={setDirection}
    />,
    { useRouter: true },
  );
  expect(setDirection).toHaveBeenCalledWith('rtl');
});

test('should call setDirection with rtl for Hebrew locale', () => {
  const setDirection = jest.fn();
  const languages = {
    ...mockedProps.languages,
    he: { flag: 'il', name: 'Hebrew', url: '/lang/he' },
  };
  render(
    <TestLanguagePicker
      locale="he"
      languages={languages}
      setDirection={setDirection}
    />,
    { useRouter: true },
  );
  expect(setDirection).toHaveBeenCalledWith('rtl');
});

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
import { ComponentType } from 'react';
import { CustomControlItem } from '@superset-ui/chart-controls';
import { render } from 'spec/helpers/testing-library';
import { useThemeMode } from '@apache-superset/core/theme';
import { handlebarsTemplateControlSetItem } from '../../src/plugin/controls/handlebarTemplate';
import { styleControlSetItem } from '../../src/plugin/controls/style';

const mockCodeEditor = jest.fn((_props: { theme?: string }) => null);

jest.mock('../../src/components/CodeEditor/CodeEditor', () => ({
  CodeEditor: (props: { theme?: string }) => mockCodeEditor(props),
}));

jest.mock('@apache-superset/core/theme', () => ({
  ...jest.requireActual('@apache-superset/core/theme'),
  useThemeMode: jest.fn(),
}));

const HandlebarsTemplateControl = (
  handlebarsTemplateControlSetItem as CustomControlItem
).config.type as ComponentType<{ value: string; onChange: () => void }>;
const StyleControl = (styleControlSetItem as CustomControlItem).config
  .type as ComponentType<{ value: string; onChange: () => void }>;

const mockedUseThemeMode = useThemeMode as jest.Mock;

afterEach(() => jest.clearAllMocks());

test('Handlebars Template editor uses the light Ace theme in a light UI', () => {
  mockedUseThemeMode.mockReturnValue(false);
  render(<HandlebarsTemplateControl value="x" onChange={jest.fn()} />);
  expect(mockCodeEditor).toHaveBeenCalledWith(
    expect.objectContaining({ theme: 'light' }),
  );
});

test('Handlebars Template editor uses the dark Ace theme in a dark UI', () => {
  mockedUseThemeMode.mockReturnValue(true);
  render(<HandlebarsTemplateControl value="x" onChange={jest.fn()} />);
  expect(mockCodeEditor).toHaveBeenCalledWith(
    expect.objectContaining({ theme: 'dark' }),
  );
});

test('CSS Styles editor uses the light Ace theme in a light UI', () => {
  mockedUseThemeMode.mockReturnValue(false);
  render(<StyleControl value="x" onChange={jest.fn()} />);
  expect(mockCodeEditor).toHaveBeenCalledWith(
    expect.objectContaining({ theme: 'light' }),
  );
});

test('CSS Styles editor uses the dark Ace theme in a dark UI', () => {
  mockedUseThemeMode.mockReturnValue(true);
  render(<StyleControl value="x" onChange={jest.fn()} />);
  expect(mockCodeEditor).toHaveBeenCalledWith(
    expect.objectContaining({ theme: 'dark' }),
  );
});

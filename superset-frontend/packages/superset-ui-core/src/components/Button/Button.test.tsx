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
import { fireEvent, render } from '@superset-ui/core/spec';
import { Button } from '.';
import {
  ButtonGallery,
  SIZES as buttonSizes,
  STYLES as buttonStyles,
} from './Button.stories';
import { getSecondaryButtonStyles } from './index';
import type { SupersetTheme } from '@apache-superset/core/theme';

test('works with an onClick handler', () => {
  const mockAction = jest.fn();
  const { getByRole } = render(<Button onClick={mockAction} />);
  fireEvent.click(getByRole('button'));
  expect(mockAction).toHaveBeenCalled();
});

test('does not handle onClicks when disabled', () => {
  const mockAction = jest.fn();
  const { getByRole } = render(<Button onClick={mockAction} disabled />);
  fireEvent.click(getByRole('button'));
  expect(mockAction).toHaveBeenCalledTimes(0);
});

// test stories from the storybook!
test('All the sorybook gallery variants mount', () => {
  const { getAllByRole } = render(<ButtonGallery />);
  const permutationCount =
    Object.values(buttonStyles.options).filter(o => o).length *
    Object.values(buttonSizes.options).length;

  expect(getAllByRole('button')).toHaveLength(permutationCount);
});

test('secondary button renders without errors', () => {
  const { getByRole } = render(
    <Button buttonStyle="secondary">Secondary</Button>,
  );
  expect(getByRole('button')).toBeInTheDocument();
});

test('getSecondaryButtonStyles uses fallback tokens when custom tokens not set', () => {
  const mockTheme = {
    colorPrimary: '#2893B3',
    colorPrimaryBg: '#e6f4f7',
    colorPrimaryBgHover: '#cce9ef',
    colorPrimaryBorder: '#99d3df',
  } as SupersetTheme;

  const styles = getSecondaryButtonStyles(mockTheme);

  expect(styles.color).toBe('#2893B3');
  expect(styles.backgroundColor).toBe('#e6f4f7');
  expect(styles.borderColor).toBe('transparent');
  expect(styles['&:hover'].backgroundColor).toBe('#cce9ef');
  expect(styles['&:active'].backgroundColor).toBe('#99d3df');
});

test('getSecondaryButtonStyles uses custom tokens when provided', () => {
  const mockTheme = {
    colorPrimary: '#2893B3',
    colorPrimaryBg: '#e6f4f7',
    colorPrimaryBgHover: '#cce9ef',
    colorPrimaryBorder: '#99d3df',
    // Custom secondary button tokens
    buttonSecondaryColor: '#custom-color',
    buttonSecondaryBg: '#custom-bg',
    buttonSecondaryBorderColor: '#custom-border',
    buttonSecondaryHoverColor: '#custom-hover-color',
    buttonSecondaryHoverBg: '#custom-hover-bg',
    buttonSecondaryHoverBorderColor: '#custom-hover-border',
    buttonSecondaryActiveColor: '#custom-active-color',
    buttonSecondaryActiveBg: '#custom-active-bg',
    buttonSecondaryActiveBorderColor: '#custom-active-border',
  } as SupersetTheme;

  const styles = getSecondaryButtonStyles(mockTheme);

  expect(styles.color).toBe('#custom-color');
  expect(styles.backgroundColor).toBe('#custom-bg');
  expect(styles.borderColor).toBe('#custom-border');
  expect(styles['&:hover'].color).toBe('#custom-hover-color');
  expect(styles['&:hover'].backgroundColor).toBe('#custom-hover-bg');
  expect(styles['&:hover'].borderColor).toBe('#custom-hover-border');
  expect(styles['&:active'].color).toBe('#custom-active-color');
  expect(styles['&:active'].backgroundColor).toBe('#custom-active-bg');
  expect(styles['&:active'].borderColor).toBe('#custom-active-border');
});

test('getSecondaryButtonStyles supports partial token overrides', () => {
  const mockTheme = {
    colorPrimary: '#2893B3',
    colorPrimaryBg: '#e6f4f7',
    colorPrimaryBgHover: '#cce9ef',
    colorPrimaryBorder: '#99d3df',
    // Only override some tokens
    buttonSecondaryBg: '#custom-bg',
    buttonSecondaryBorderColor: '#custom-border',
  } as SupersetTheme;

  const styles = getSecondaryButtonStyles(mockTheme);

  // Should use custom values where provided
  expect(styles.backgroundColor).toBe('#custom-bg');
  expect(styles.borderColor).toBe('#custom-border');
  // Should fallback to Ant Design tokens where not provided
  expect(styles.color).toBe('#2893B3');
  expect(styles['&:hover'].backgroundColor).toBe('#cce9ef');
});

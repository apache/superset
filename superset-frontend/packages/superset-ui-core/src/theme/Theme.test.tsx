import React from 'react';
import { render } from '@testing-library/react';
import { Theme } from './Theme';
import '@testing-library/jest-dom';

describe('Theme Class', () => {
  test('should initialize with default system colors', () => {
    const theme = new Theme();
    const themeConfig = theme.getTheme();
    expect(themeConfig.colors.primary.base).toBe('#20a7c9');
    expect(themeConfig.colors.darkest).toBe('#000');
    expect(themeConfig.colors.lightest).toBe('#FFF');
  });

  test('should apply custom system colors and dark mode', () => {
    const customColors = { primary: '#ff0000' };
    const theme = new Theme(customColors, true);
    const themeConfig = theme.getTheme();
    expect(themeConfig.colors.primary.base).toBe('#ff0000');
    expect(themeConfig.colors.darkest).toBe('#FFF');
    expect(themeConfig.colors.lightest).toBe('#000');
  });
});

describe('SupersetThemeProvider Component', () => {
  test('should render children without errors', () => {
    const theme = new Theme();
    const { getByText } = render(
      <theme.SupersetThemeProvider>
        <div>Test Child</div>
      </theme.SupersetThemeProvider>,
    );
    expect(getByText('Test Child')).toBeInTheDocument();
  });
});

// themeDecorator.js
import { Theme } from '@superset-ui/core';

// Create dynamic theme for demo storybook
const dynamicTheme = Theme.fromConfig();

const ThemeDecorator = Story => (
  <dynamicTheme.SupersetThemeProvider>{<Story />}</dynamicTheme.SupersetThemeProvider>
);

export default ThemeDecorator;

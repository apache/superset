// themeDecorator.js
import { supersetTheme, ThemeProvider } from '@apache-superset/core/ui';

const ThemeDecorator = Story => (
  <ThemeProvider theme={supersetTheme}>
    <Story />
  </ThemeProvider>
);

export default ThemeDecorator;

// themeDecorator.js
import React from 'react';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';

const ThemeDecorator = Story => (
  <ThemeProvider theme={supersetTheme}>{<Story />}</ThemeProvider>
);

export default ThemeDecorator;

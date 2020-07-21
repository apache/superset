import React from 'react';
import { addDecorator } from '@storybook/react';
import { jsxDecorator } from 'storybook-addon-jsx';

import { supersetTheme, ThemeProvider } from '@superset-ui/style';

import '../src/theme.ts';
const themeDecorator = storyFn => (
  <ThemeProvider theme={supersetTheme}>{storyFn()}</ThemeProvider>
);

addDecorator(jsxDecorator);
addDecorator(themeDecorator);
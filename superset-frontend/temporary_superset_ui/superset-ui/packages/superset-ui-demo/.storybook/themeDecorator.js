// themeDecorator.js
import React from "react"
import { ThemeProvider } from 'emotion-theming';
import { supersetTheme } from '@superset-ui/style';

const ThemeDecorator = storyFn => (
  <ThemeProvider theme={supersetTheme}>{storyFn()}</ThemeProvider>
)

export default ThemeDecorator
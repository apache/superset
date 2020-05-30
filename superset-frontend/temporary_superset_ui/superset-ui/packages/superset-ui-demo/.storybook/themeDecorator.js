// themeDecorator.js
import React from "react"
import { supersetTheme, ThemeProvider } from '@superset-ui/style';

const ThemeDecorator = storyFn => (
  <ThemeProvider theme={supersetTheme}>{storyFn()}</ThemeProvider>
)

export default ThemeDecorator
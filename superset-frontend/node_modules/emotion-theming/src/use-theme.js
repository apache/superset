// @flow
import React from 'react'
import { ThemeContext } from '@emotion/core'

export default function useTheme() {
  return React.useContext(ThemeContext)
}

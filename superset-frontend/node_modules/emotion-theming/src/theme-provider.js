// @flow
import * as React from 'react'
import { ThemeContext } from '@emotion/core'
import weakMemoize from '@emotion/weak-memoize'

let getTheme = (outerTheme: Object, theme: Object | (Object => Object)) => {
  if (typeof theme === 'function') {
    const mergedTheme = theme(outerTheme)
    if (
      process.env.NODE_ENV !== 'production' &&
      (mergedTheme == null ||
        typeof mergedTheme !== 'object' ||
        Array.isArray(mergedTheme))
    ) {
      throw new Error(
        '[ThemeProvider] Please return an object from your theme function, i.e. theme={() => ({})}!'
      )
    }
    return mergedTheme
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    (theme == null || typeof theme !== 'object' || Array.isArray(theme))
  ) {
    throw new Error(
      '[ThemeProvider] Please make your theme prop a plain object'
    )
  }

  return { ...outerTheme, ...theme }
}

let createCacheWithTheme = weakMemoize(outerTheme => {
  return weakMemoize(theme => {
    return getTheme(outerTheme, theme)
  })
})

type Props = {
  theme: Object | (Object => Object),
  children: React.Node
}

let ThemeProvider = (props: Props) => {
  return (
    <ThemeContext.Consumer>
      {theme => {
        if (props.theme !== theme) {
          theme = createCacheWithTheme(theme)(props.theme)
        }
        return (
          <ThemeContext.Provider value={theme}>
            {props.children}
          </ThemeContext.Provider>
        )
      }}
    </ThemeContext.Consumer>
  )
}

export default ThemeProvider

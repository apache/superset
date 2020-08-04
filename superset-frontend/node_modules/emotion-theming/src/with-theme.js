// @flow
import * as React from 'react'
import hoistNonReactStatics from 'hoist-non-react-statics'
import { ThemeContext } from '@emotion/core'

type Props = { theme: Object }

// should we change this to be forwardRef/withCSSContext style so it doesn't merge with props?

export default function withTheme<Config: {}>(
  Component: React.AbstractComponent<Config>
): React.AbstractComponent<$Diff<Config, Props>> {
  const componentName = Component.displayName || Component.name || 'Component'
  let render = (props, ref) => {
    return (
      <ThemeContext.Consumer>
        {theme => {
          return <Component theme={theme} ref={ref} {...props} />
        }}
      </ThemeContext.Consumer>
    )
  }
  // $FlowFixMe
  let WithTheme = React.forwardRef(render)

  WithTheme.displayName = `WithTheme(${componentName})`

  return hoistNonReactStatics(WithTheme, Component)
}

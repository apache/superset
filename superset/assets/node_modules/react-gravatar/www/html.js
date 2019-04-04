import React from 'react'

import { prefixLink } from 'gatsby-helpers'
import HTMLScripts from 'html-scripts'
import HTMLStyles from 'html-styles'
import { GoogleFont, TypographyStyle } from 'typography-react'
import typography from './utils/typography'

module.exports = React.createClass({
  render () {
    return (
      <html lang="en">
        <head>
          <title>React Gravatar</title>
          <meta charSet="utf-8" />
          <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0 maximum-scale=5.0"
          />
          <HTMLStyles />
          <GoogleFont typography={typography} />
          <TypographyStyle typography={typography} />
          {this.props.headComponents}
        </head>
        <body>
          <div id="react-mount" dangerouslySetInnerHTML={{ __html: this.props.body }} />
          <HTMLScripts scripts={this.props.scripts} />
        </body>
      </html>
    )
  },
})

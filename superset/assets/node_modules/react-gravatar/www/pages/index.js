import React from 'react'

import { Container } from 'react-responsive-grid'
import { rhythm } from 'utils/typography'
import Gravatar from '../../src/'

const IndexRoute = React.createClass({
  render () {
    return (
      <Container
        style={{
          maxWidth: 960,
          marginBottom: rhythm(1),
          padding: `${rhythm(1)} ${rhythm(1/2)}`,
          paddingTop: rhythm(2),
        }}
      >
        <div>
          <h1>React Gravatar</h1>
          <p>
            <a href="https://github.com/KyleAMathews/react-gravatar">Code on Github</a>
          </p>
          <p>
            React component for rendering a gravatar profile image. Adjusts automatically for retina displays.
          </p>
          <h2>Install</h2>
          <code>npm install --save react-gravatar</code>
          <br />
          <br />

          <h2>Usage</h2>
          <pre>
            <code>
              {`import Gravatar from 'react-gravatar'
  <Gravatar email="a-email@example.com" />`}
            </code>
          </pre>

          <h2>A few examples</h2>

          <code
            style={{
              display: 'block',
              marginBottom: rhythm(1/2),
            }}
          >
            {'<Gravatar email="mathews.kyle@gmail.com" />'}
          </code>
          <Gravatar email="mathews.kyle@gmail.com" />

          <code
            style={{
              display: 'block',
              marginBottom: rhythm(1/2),
            }}
          >
            {'<Gravatar email="mathews.kyle@gmail.com" size={150} />'}
          </code>
          <Gravatar email="mathews.kyle@gmail.com" size={150} />

          <p>For emails without a gravatar, use the retro default. You can override this by passing in a different 'default' prop. See https://en.gravatar.com/site/implement/images/ for options.</p>
          <code
            style={{
              display: 'block',
              marginBottom: rhythm(1/2),
            }}
          >
            {'<Gravatar email="blah@blah.com" />'}
          </code>
          <Gravatar email="blah@blah.com" />

          <h4>Override all defaults</h4>
          <code
            style={{
              display: 'block',
              marginBottom: rhythm(1/2),
            }}
          >
            {'<Gravatar email="blahblah@blah.com" size={150} rating="pg" default="monsterid" className="CustomAvatar-image" />'}
          </code>
          <Gravatar email="blahblah@blah.com" size={150} rating="pg" default="monsterid" className="CustomAvatar-image" />

          <h2>Props</h2>
          <ul>
            <li><code>email: React.PropTypes.string</code> — email address to generate Gravatar image for.</li>
            <li><code>md5: React.PropTypes.string</code> — Optionally just pass in a precomputed md5 hash instead of an email.</li>
            <li><code>size: React.PropTypes.number</code> — Size in pixels of image to generate. Images are always square. Defaults to 50</li>
            <li><code>rating: React.PropTypes.string</code> — rating to use. Defaults to 'g'</li>
            <li><code>default: React.PropTypes.string</code> — Pick the type of fallback image to use. Defaults to 'retro'</li>
            <li><code>className: React.PropTypes.string</code> — Add a className to the generated image.</li>
            <li><code>style: React.PropTypes.object</code> — Set styles on the image.</li>
            <li><code>protocol: React.PropTypes.string</code> — Use different protocol (http://, https://, etc.) Defaults to '//'</li>
          </ul>
        </div>
      </Container>
    )
  },
})

export default IndexRoute

export const pageQuery = `
{
  site {
    siteMetadata {
      title
    }
  }
}
`

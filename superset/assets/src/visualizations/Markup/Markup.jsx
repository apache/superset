/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import './Markup.css';

const propTypes = {
  className: PropTypes.string,
  height: PropTypes.number.isRequired,
  isSeparator: PropTypes.bool,
  html: PropTypes.string,
  cssFiles: PropTypes.arrayOf(PropTypes.string),
};
const defaultProps = {
  className: '',
  isSeparator: false,
  html: '',
};

const CONTAINER_STYLE = {
  position: 'relative',
  overflow: 'auto',
};

class Markup extends React.PureComponent {
  render() {
    const { className, height, isSeparator, html, cssFiles } = this.props;

    return (
      <div
        className={className}
        style={CONTAINER_STYLE}
      >
        <iframe
          title="superset-markup"
          frameBorder={0}
          height={isSeparator ? height - 20 : height}
          sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation"
          srcDoc={`
            <html>
              <head>
                ${cssFiles.map(
                  href => `<link rel="stylesheet" type="text/css" href="${href}" />`,
                )}
              </head>
              <body style="background-color: transparent;">
                ${html}
              </body>
            </html>`
          }
        />
      </div>
    );
  }
}

Markup.propTypes = propTypes;
Markup.defaultProps = defaultProps;

export default Markup;

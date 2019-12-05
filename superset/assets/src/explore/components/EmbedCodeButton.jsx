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
import { Popover, OverlayTrigger } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import CopyToClipboard from './../../components/CopyToClipboard';
import { getExploreLongUrl } from '../exploreUtils';

const propTypes = {
  latestQueryFormData: PropTypes.object.isRequired,
};

export default class EmbedCodeButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      height: '400',
      width: '600',
    };
    this.handleInputChange = this.handleInputChange.bind(this);
  }

  handleInputChange(e) {
    const value = e.currentTarget.value;
    const name = e.currentTarget.name;
    const data = {};
    data[name] = value;
    this.setState(data);
  }

  generateEmbedHTML() {
    const srcLink =
      window.location.origin +
      getExploreLongUrl(this.props.latestQueryFormData, 'standalone') +
      `&height=${this.state.height}`;
    return (
      '<iframe\n' +
      `  width="${this.state.width}"\n` +
      `  height="${this.state.height}"\n` +
      '  seamless\n' +
      '  frameBorder="0"\n' +
      '  scrolling="no"\n' +
      `  src="${srcLink}"\n` +
      '>\n' +
      '</iframe>'
    );
  }

  renderPopover() {
    const html = this.generateEmbedHTML();
    return (
      <Popover id="embed-code-popover">
        <div>
          <div className="row">
            <div className="col-sm-10">
              <textarea
                name="embedCode"
                value={html}
                rows="4"
                readOnly
                className="form-control input-sm"
              />
            </div>
            <div className="col-sm-2">
              <CopyToClipboard
                shouldShowText={false}
                text={html}
                copyNode={
                  <i
                    className="fa fa-clipboard"
                    title={t('Copy to clipboard')}
                  />
                }
              />
            </div>
          </div>
          <br />
          <div className="row">
            <div className="col-md-6 col-sm-12">
              <div className="form-group">
                <small>
                  <label className="control-label" htmlFor="embed-height">
                    {t('Height')}
                  </label>
                </small>
                <input
                  className="form-control input-sm"
                  type="text"
                  defaultValue={this.state.height}
                  name="height"
                  onChange={this.handleInputChange}
                />
              </div>
            </div>
            <div className="col-md-6 col-sm-12">
              <div className="form-group">
                <small>
                  <label className="control-label" htmlFor="embed-width">
                    {t('Width')}
                  </label>
                </small>
                <input
                  className="form-control input-sm"
                  type="text"
                  defaultValue={this.state.width}
                  name="width"
                  onChange={this.handleInputChange}
                  id="embed-width"
                />
              </div>
            </div>
          </div>
        </div>
      </Popover>
    );
  }
  render() {
    return (
      <OverlayTrigger
        trigger="click"
        rootClose
        placement="left"
        overlay={this.renderPopover()}
      >
        <span className="btn btn-default btn-sm" data-test="embed-code-button">
          <i className="fa fa-code" />
          &nbsp;
        </span>
      </OverlayTrigger>
    );
  }
}

EmbedCodeButton.propTypes = propTypes;

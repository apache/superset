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
import { t } from '@superset-ui/core';

import Popover from 'src/components/Popover';
import { FormLabel } from 'src/components/Form';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';
import CopyToClipboard from 'src/components/CopyToClipboard';
import { URL_PARAMS } from 'src/constants';
import { getChartPermalink } from 'src/utils/urlUtils';

export default class EmbedCodeButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      height: '400',
      width: '600',
      url: '',
      errorMessage: '',
    };
    this.handleInputChange = this.handleInputChange.bind(this);
    this.updateUrl = this.updateUrl.bind(this);
  }

  handleInputChange(e) {
    const { value, name } = e.currentTarget;
    const data = {};
    data[name] = value;
    this.setState(data);
  }

  updateUrl() {
    this.setState({ url: '' });
    getChartPermalink(this.props.formData)
      .then(url => this.setState({ errorMessage: '', url }))
      .catch(() => {
        this.setState({ errorMessage: t('Error') });
        this.props.addDangerToast(
          t('Sorry, something went wrong. Try again later.'),
        );
      });
  }

  generateEmbedHTML() {
    if (!this.state.url) return '';
    const srcLink = `${this.state.url}?${URL_PARAMS.standalone.name}=1&height=${this.state.height}`;
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

  renderPopoverContent() {
    const html = this.generateEmbedHTML();
    const text =
      this.state.errorMessage || html || t('Generating link, please wait..');
    return (
      <div id="embed-code-popover" data-test="embed-code-popover">
        <div className="row">
          <div className="col-sm-10">
            <textarea
              data-test="embed-code-textarea"
              name="embedCode"
              disabled={!html}
              value={text}
              rows="4"
              readOnly
              className="form-control input-sm"
              style={{ resize: 'vertical' }}
            />
          </div>
          <div className="col-sm-2">
            <CopyToClipboard
              shouldShowText={false}
              text={html}
              copyNode={
                <i className="fa fa-clipboard" title={t('Copy to clipboard')} />
              }
            />
          </div>
        </div>
        <br />
        <div className="row">
          <div className="col-md-6 col-sm-12">
            <div className="form-group">
              <small>
                <FormLabel htmlFor="embed-height">{t('Height')}</FormLabel>
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
                <FormLabel htmlFor="embed-width">{t('Width')}</FormLabel>
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
    );
  }

  render() {
    return (
      <Popover
        trigger="click"
        placement="left"
        onClick={this.updateUrl}
        content={this.renderPopoverContent()}
      >
        <Tooltip
          id="embed-code-tooltip"
          placement="top"
          title="Embed code"
          trigger={['hover']}
        >
          <div
            className="btn btn-default btn-sm"
            data-test="embed-code-button"
            style={{ display: 'flex', alignItems: 'center', height: 30 }}
          >
            <Icons.Code iconSize="l" />
          </div>
        </Tooltip>
      </Popover>
    );
  }
}

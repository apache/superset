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
import { t } from '@superset-ui/core';
import Popover from 'src/common/components/Popover';
import CopyToClipboard from 'src/components/CopyToClipboard';
import { getShortUrl } from 'src/utils/urlUtils';
import withToasts from 'src/messageToasts/enhancers/withToasts';

const propTypes = {
  url: PropTypes.string,
  emailSubject: PropTypes.string,
  emailContent: PropTypes.string,
  addDangerToast: PropTypes.func.isRequired,
  placement: PropTypes.oneOf(['right', 'left', 'top', 'bottom']),
};

class URLShortLinkButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      shortUrl: '',
    };
    this.onShortUrlSuccess = this.onShortUrlSuccess.bind(this);
    this.getCopyUrl = this.getCopyUrl.bind(this);
  }

  onShortUrlSuccess(shortUrl) {
    this.setState(() => ({
      shortUrl,
    }));
  }

  getCopyUrl(e) {
    e.stopPropagation();
    getShortUrl(this.props.url)
      .then(this.onShortUrlSuccess)
      .catch(this.props.addDangerToast);
  }

  renderPopover() {
    const emailBody = t('%s%s', this.props.emailContent, this.state.shortUrl);
    return (
      <div id="shorturl-popover" data-test="shorturl-popover">
        <CopyToClipboard
          text={this.state.shortUrl}
          copyNode={
            <i className="fa fa-clipboard" title={t('Copy to clipboard')} />
          }
        />
        &nbsp;&nbsp;
        <a
          href={`mailto:?Subject=${this.props.emailSubject}%20&Body=${emailBody}`}
        >
          <i className="fa fa-envelope" />
        </a>
      </div>
    );
  }

  render() {
    return (
      <Popover
        trigger="click"
        placement={this.props.placement}
        onClick={this.getCopyUrl}
        content={this.renderPopover()}
      >
        <span
          className="short-link-trigger btn btn-default btn-sm"
          role="button"
        >
          <i className="short-link-trigger fa fa-link" />
          &nbsp;
        </span>
      </Popover>
    );
  }
}

URLShortLinkButton.defaultProps = {
  url: window.location.href.substring(window.location.origin.length),
  placement: 'left',
  emailSubject: '',
  emailContent: '',
};

URLShortLinkButton.propTypes = propTypes;

export default withToasts(URLShortLinkButton);

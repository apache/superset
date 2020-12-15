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
import CopyToClipboard from './CopyToClipboard';
import { getShortUrl } from '../utils/common';
import withToasts from '../messageToasts/enhancers/withToasts';
import ModalTrigger from './ModalTrigger';

type URLShortLinkModalProps = {
  url: string;
  emailSubject: string;
  emailContent: string;
  title?: string;
  addDangerToast: (msg: string) => void;
  triggerNode: JSX.Element;
};

type URLShortLinkModalState = {
  shortUrl: string;
};

class URLShortLinkModal extends React.Component<
  URLShortLinkModalProps,
  URLShortLinkModalState
> {
  static defaultProps = {
    url: window.location.href.substring(window.location.origin.length),
    emailSubject: '',
    emailContent: '',
  };

  modal: ModalTrigger | null;

  constructor(props: URLShortLinkModalProps) {
    super(props);
    this.state = {
      shortUrl: '',
    };
    this.modal = null;
    this.setModalRef = this.setModalRef.bind(this);
    this.onShortUrlSuccess = this.onShortUrlSuccess.bind(this);
    this.getCopyUrl = this.getCopyUrl.bind(this);
  }

  onShortUrlSuccess(shortUrl: string) {
    this.setState(() => ({ shortUrl }));
  }

  setModalRef(ref: ModalTrigger | null) {
    this.modal = ref;
  }

  getCopyUrl() {
    getShortUrl(this.props.url)
      .then(this.onShortUrlSuccess)
      .catch(this.props.addDangerToast);
  }

  render() {
    const emailBody = t('%s%s', this.props.emailContent, this.state.shortUrl);
    return (
      <ModalTrigger
        ref={this.setModalRef}
        triggerNode={this.props.triggerNode}
        beforeOpen={this.getCopyUrl}
        modalTitle={this.props.title || t('Share Dashboard')}
        modalBody={
          <div>
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
        }
      />
    );
  }
}

export default withToasts(URLShortLinkModal);

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
import { Component, cloneElement, ReactNode, ReactElement } from 'react';
import { t } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import withToasts from 'src/components/MessageToasts/withToasts';
import copyTextToClipboard from 'src/utils/copy';

export interface CopyToClipboardProps {
  copyNode?: ReactNode;
  getText?: (callback: (data: string) => void) => void;
  onCopyEnd?: () => void;
  shouldShowText?: boolean;
  text?: string;
  wrapped?: boolean;
  tooltipText?: string;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  hideTooltip?: boolean;
}

const defaultProps: Partial<CopyToClipboardProps> = {
  copyNode: <span>{t('Copy')}</span>,
  onCopyEnd: () => {},
  shouldShowText: true,
  wrapped: true,
  tooltipText: t('Copy to clipboard'),
  hideTooltip: false,
};

class CopyToClipboard extends Component<CopyToClipboardProps> {
  static defaultProps = defaultProps;

  constructor(props: CopyToClipboardProps) {
    super(props);
    this.copyToClipboard = this.copyToClipboard.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  onClick() {
    if (this.props.getText) {
      this.props.getText((d: string) => {
        this.copyToClipboard(Promise.resolve(d));
      });
    } else {
      this.copyToClipboard(Promise.resolve(this.props.text || ''));
    }
  }

  getDecoratedCopyNode() {
    return cloneElement(this.props.copyNode as ReactElement, {
      style: { cursor: 'pointer' },
      onClick: this.onClick,
    });
  }

  copyToClipboard(textToCopy: Promise<string>) {
    copyTextToClipboard(() => textToCopy)
      .then(() => {
        this.props.addSuccessToast(t('Copied to clipboard!'));
      })
      .catch(() => {
        this.props.addDangerToast(
          t(
            'Sorry, your browser does not support copying. Use Ctrl / Cmd + C!',
          ),
        );
      })
      .finally(() => {
        if (this.props.onCopyEnd) this.props.onCopyEnd();
      });
  }

  renderTooltip(cursor: string) {
    return (
      <>
        {!this.props.hideTooltip ? (
          <Tooltip
            id="copy-to-clipboard-tooltip"
            placement="topRight"
            style={{ cursor }}
            title={this.props.tooltipText || ''}
            trigger={['hover']}
            arrowPointAtCenter
          >
            {this.getDecoratedCopyNode()}
          </Tooltip>
        ) : (
          this.getDecoratedCopyNode()
        )}
      </>
    );
  }

  renderNotWrapped() {
    return this.renderTooltip('pointer');
  }

  renderLink() {
    return (
      <span css={{ display: 'inline-flex', alignItems: 'center' }}>
        {this.props.shouldShowText && this.props.text && (
          <span className="m-r-5" data-test="short-url">
            {this.props.text}
          </span>
        )}
        {this.renderTooltip('pointer')}
      </span>
    );
  }

  render() {
    const { wrapped } = this.props;
    if (!wrapped) {
      return this.renderNotWrapped();
    }
    return this.renderLink();
  }
}

export default withToasts(CopyToClipboard);

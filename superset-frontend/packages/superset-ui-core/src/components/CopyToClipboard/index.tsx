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
import {
  Component,
  cloneElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { css, type SupersetTheme } from '@apache-superset/core/ui';
import { t } from '@apache-superset/core';
import { copyTextToClipboard } from '../../utils/clipboard';
import { Tooltip } from '../Tooltip';

export interface CopyToClipboardProps {
  /** The clickable element that triggers the copy action */
  copyNode?: ReactNode;
  /** Async function to get text to copy (alternative to `text` prop) */
  getText?: (callback: (data: string) => void) => void;
  /** Called after copy attempt completes (success or failure) */
  onCopyEnd?: () => void;
  /** Called when copy succeeds */
  onSuccess?: () => void;
  /** Called when copy fails */
  onError?: (error: Error) => void;
  /** Whether to show the text alongside the copy button */
  shouldShowText?: boolean;
  /** Static text to copy (alternative to `getText` prop) */
  text?: string;
  /** Whether to wrap in a span with text display */
  wrapped?: boolean;
  /** Tooltip text shown on hover */
  tooltipText?: string;
  /** Hide the tooltip entirely */
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

export class CopyToClipboard extends Component<CopyToClipboardProps> {
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
        this.props.onSuccess?.();
      })
      .catch((error: Error) => {
        this.props.onError?.(error);
      })
      .finally(() => {
        this.props.onCopyEnd?.();
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
            arrow={{ pointAtCenter: true }}
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
          <span
            data-test="short-url"
            css={(theme: SupersetTheme) => css`
              margin-right: ${theme.sizeUnit}px;
            `}
          >
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

export default CopyToClipboard;

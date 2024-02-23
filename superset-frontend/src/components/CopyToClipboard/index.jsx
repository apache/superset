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
import { Tooltip } from 'src/components/Tooltip';
import withToasts from 'src/components/MessageToasts/withToasts';
import copyTextToClipboard from 'src/utils/copy';

const propTypes = {
  copyNode: PropTypes.node,
  getText: PropTypes.func,
  onCopyEnd: PropTypes.func,
  shouldShowText: PropTypes.bool,
  text: PropTypes.string,
  wrapped: PropTypes.bool,
  tooltipText: PropTypes.string,
  addDangerToast: PropTypes.func.isRequired,
  addSuccessToast: PropTypes.func.isRequired,
  hideTooltip: PropTypes.bool,
};

const defaultProps = {
  copyNode: <span>{t('Copy')}</span>,
  onCopyEnd: () => {},
  shouldShowText: true,
  wrapped: true,
  tooltipText: t('Copy to clipboard'),
  hideTooltip: false,
};

class CopyToClipboard extends React.Component {
  constructor(props) {
    super(props);

    // bindings
    this.copyToClipboard = this.copyToClipboard.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  onClick() {
    if (this.props.getText) {
      this.props.getText(d => {
        this.copyToClipboard(Promise.resolve(d));
      });
    } else {
      this.copyToClipboard(Promise.resolve(this.props.text));
    }
  }

  getDecoratedCopyNode() {
    return React.cloneElement(this.props.copyNode, {
      style: { cursor: 'pointer' },
      onClick: this.onClick,
    });
  }

  copyToClipboard(textToCopy) {
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
        this.props.onCopyEnd();
      });
  }

  renderTooltip(cursor) {
    return (
      <>
        {!this.props.hideTooltip ? (
          <Tooltip
            id="copy-to-clipboard-tooltip"
            placement="topRight"
            style={{ cursor }}
            title={this.props.tooltipText}
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
        {this.renderTooltip()}
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

CopyToClipboard.propTypes = propTypes;
CopyToClipboard.defaultProps = defaultProps;

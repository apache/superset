import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip, OverlayTrigger, MenuItem } from 'react-bootstrap';
import { t } from '../locales';

const propTypes = {
  copyNode: PropTypes.node,
  getText: PropTypes.func,
  onCopyEnd: PropTypes.func,
  shouldShowText: PropTypes.bool,
  text: PropTypes.string,
  inMenu: PropTypes.bool,
  tooltipText: PropTypes.string,
};

const defaultProps = {
  copyNode: <span>Copy</span>,
  onCopyEnd: () => {},
  shouldShowText: true,
  inMenu: false,
  tooltipText: t('Copy to clipboard'),
};

export default class CopyToClipboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasCopied: false,
    };

    // bindings
    this.copyToClipboard = this.copyToClipboard.bind(this);
    this.resetTooltipText = this.resetTooltipText.bind(this);
    this.onMouseOut = this.onMouseOut.bind(this);
  }

  onMouseOut() {
    // delay to avoid flash of text change on tooltip
    setTimeout(this.resetTooltipText, 200);
  }

  onClick() {
    if (this.props.getText) {
      this.props.getText((d) => { this.copyToClipboard(d); });
    } else {
      this.copyToClipboard(this.props.text);
    }
  }

  resetTooltipText() {
    this.setState({ hasCopied: false });
  }

  copyToClipboard(textToCopy) {
    const selection = document.getSelection();
    selection.removeAllRanges();
    document.activeElement.blur();
    const range = document.createRange();
    const span = document.createElement('span');
    span.textContent = textToCopy;
    span.style.all = 'unset';
    span.style.position = 'fixed';
    span.style.top = 0;
    span.style.clip = 'rect(0, 0, 0, 0)';
    span.style.whiteSpace = 'pre';

    document.body.appendChild(span);
    range.selectNode(span);
    selection.addRange(range);
    try {
      if (!document.execCommand('copy')) {
        throw new Error(t('Not successful'));
      }
    } catch (err) {
      window.alert(t('Sorry, your browser does not support copying. Use Ctrl / Cmd + C!')); // eslint-disable-line
    }

    document.body.removeChild(span);
    if (selection.removeRange) {
      selection.removeRange(range);
    } else {
      selection.removeAllRanges();
    }

    this.setState({ hasCopied: true });
    this.props.onCopyEnd();
  }

  tooltipText() {
    if (this.state.hasCopied) {
      return t('Copied!');
    }
    return this.props.tooltipText;
  }

  renderLink() {
    return (
      <span>
        {this.props.shouldShowText &&
          <span>
            {this.props.text}
            &nbsp;&nbsp;&nbsp;&nbsp;
          </span>
        }
        <OverlayTrigger
          placement="top"
          style={{ cursor: 'pointer' }}
          overlay={this.renderTooltip()}
          trigger={['hover']}
          bsStyle="link"
          onClick={this.onClick.bind(this)}
          onMouseOut={this.onMouseOut}
        >
          {this.props.copyNode}
        </OverlayTrigger>
      </span>
    );
  }

  renderInMenu() {
    return (
      <OverlayTrigger placement="top" overlay={this.renderTooltip()} trigger={['hover']}>
        <MenuItem>
          <span
            onClick={this.onClick.bind(this)}
            onMouseOut={this.onMouseOut}
          >
            {this.props.copyNode}
          </span>
        </MenuItem>
      </OverlayTrigger>
    );
  }

  renderTooltip() {
    return (
      <Tooltip id="copy-to-clipboard-tooltip">
        {this.tooltipText()}
      </Tooltip>
    );
  }

  render() {
    let html;
    if (this.props.inMenu) {
      html = this.renderInMenu();
    } else {
      html = this.renderLink();
    }
    return html;
  }
}

CopyToClipboard.propTypes = propTypes;
CopyToClipboard.defaultProps = defaultProps;

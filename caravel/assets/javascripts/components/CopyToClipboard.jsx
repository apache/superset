import React, { PropTypes } from 'react';
import { Button, Tooltip, OverlayTrigger } from 'react-bootstrap';

const propTypes = {
  copyNode: PropTypes.node,
  onCopyEnd: PropTypes.func,
  shouldShowText: PropTypes.bool,
  text: PropTypes.string.isRequired,
  inMenu: PropTypes.bool,
};

const defaultProps = {
  copyNode: <span>Copy</span>,
  onCopyEnd: () => {},
  shouldShowText: true,
  inMenu: false,
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

  resetTooltipText() {
    this.setState({ hasCopied: false });
  }

  copyToClipboard() {
    const textToCopy = this.props.text;
    const textArea = document.createElement('textarea');

    textArea.style.position = 'fixed';
    textArea.style.left = '-1000px';
    textArea.value = textToCopy;

    document.body.appendChild(textArea);
    textArea.select();

    try {
      if (!document.execCommand('copy')) {
        throw new Error('Not successful');
      }
    } catch (err) {
      window.alert('Sorry, your browser does not support copying. Use Ctrl / Cmd + C!'); // eslint-disable-line
    }

    document.body.removeChild(textArea);

    this.setState({ hasCopied: true });
    this.props.onCopyEnd();
  }

  tooltipText() {
    let tooltipText;
    if (this.state.hasCopied) {
      tooltipText = 'Copied!';
    } else {
      tooltipText = 'Copy text';
    }
    return tooltipText;
  }

  renderLink() {
    return (
      <span>
        {this.props.shouldShowText &&
          <span>{this.props.text}</span>
        }
        &nbsp;&nbsp;&nbsp;&nbsp;
        <OverlayTrigger placement="top" overlay={this.renderTooltip()} trigger={['hover']}>
          <Button
            bsStyle="link"
            onClick={this.copyToClipboard}
            onMouseOut={this.onMouseOut}
          >
            {this.props.copyNode}
          </Button>
        </OverlayTrigger>
      </span>
    );
  }

  renderInMenu() {
    return (
      <OverlayTrigger placement="top" overlay={this.renderTooltip()} trigger={['hover']}>
        <span
          onClick={this.copyToClipboard}
          onMouseOut={this.onMouseOut}
        >
          {this.props.copyNode}
        </span>
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

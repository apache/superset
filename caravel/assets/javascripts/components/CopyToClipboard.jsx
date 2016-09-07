import React, { PropTypes } from 'react';

const propTypes = {
  copyNode: PropTypes.node,
  onCopyEnd: PropTypes.func,
  shouldShowText: PropTypes.bool,
  text: PropTypes.string.isRequired,
};

const defaultProps = {
  copyNode: <span>Copy</span>,
  onCopyEnd: () => {},
  shouldShowText: true,
};

export default class CopyToClipboard extends React.Component {
  copyToClipboard(e) {
    e.preventDefault();
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

    this.props.onCopyEnd();
  }

  render() {
    return (
      <div>
        {this.props.shouldShowText &&
          <span>{this.props.text}</span>
        }
        &nbsp;&nbsp;&nbsp;&nbsp;
        <a
          href="#"
          title="Copy to clipboard"
          onClick={(e) => { this.copyToClipboard(e) }}
        >
          {this.props.copyNode}
        </a>
      </div>
    );
  }
}

CopyToClipboard.propTypes = propTypes;
CopyToClipboard.defaultProps = defaultProps;

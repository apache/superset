import React, { PropTypes } from 'react';
import { Popover, OverlayTrigger } from 'react-bootstrap';
import CopyToClipboard from './../../components/CopyToClipboard';

const propTypes = {
  slice: PropTypes.object.isRequired,
};

export default class URLShortLinkButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      shortUrl: '',
    };
  }

  renderPopover() {
    return (
      <Popover id="shorturl-popover">
        <CopyToClipboard
          text={window.location.pathname + window.location.search}
          copyNode={<i className="fa fa-clipboard" title="Copy to clipboard"></i>}
        />
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
        <span className="btn btn-default btn-sm">
          <i className="fa fa-link"></i>&nbsp;
        </span>
      </OverlayTrigger>
    );
  }
}

URLShortLinkButton.propTypes = propTypes;

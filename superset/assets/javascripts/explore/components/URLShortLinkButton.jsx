import React, { PropTypes } from 'react';
import { Popover, OverlayTrigger } from 'react-bootstrap';
import CopyToClipboard from './../../components/CopyToClipboard';
import { getShortUrl } from '../../../utils/common';

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

  onShortUrlSuccess(data) {
    this.setState({
      shortUrl: data,
    });
  }

  getCopyUrl() {
    const longUrl = window.location.pathname + window.location.search;
    getShortUrl(longUrl, this.onShortUrlSuccess.bind(this));
  }

  renderPopover() {
    const emailBody = `Check out this slice: ${this.state.shortUrl}`;
    return (
      <Popover id="shorturl-popover">
        <CopyToClipboard
          text={this.state.shortUrl}
          copyNode={<i className="fa fa-clipboard" title="Copy to clipboard"></i>}
        />
        &nbsp;&nbsp;
        <a href={`mailto:?Subject=Superset%20Slice%20&Body=${emailBody}`}>
          <i className="fa fa-envelope"></i>
        </a>
      </Popover>
    );
  }

  render() {
    return (
      <OverlayTrigger
        trigger="click"
        rootClose
        placement="left"
        onEnter={this.getCopyUrl.bind(this)}
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

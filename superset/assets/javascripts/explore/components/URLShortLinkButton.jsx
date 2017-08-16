import React from 'react';
import PropTypes from 'prop-types';
import { Popover, OverlayTrigger } from 'react-bootstrap';
import CopyToClipboard from './../../components/CopyToClipboard';
import { getShortUrl } from '../../../utils/common';
import { t } from '../../locales';

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
    const emailBody = t('Check out this slice: %s', this.state.shortUrl);
    return (
      <Popover id="shorturl-popover">
        <CopyToClipboard
          text={this.state.shortUrl}
          copyNode={<i className="fa fa-clipboard" title={t('Copy to clipboard')} />}
        />
        &nbsp;&nbsp;
        <a href={`mailto:?Subject=Superset%20Slice%20&Body=${emailBody}`}>
          <i className="fa fa-envelope" />
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
          <i className="fa fa-link" />&nbsp;
        </span>
      </OverlayTrigger>
    );
  }
}

URLShortLinkButton.propTypes = propTypes;

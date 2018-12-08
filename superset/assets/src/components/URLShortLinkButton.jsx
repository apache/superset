import React from 'react';
import PropTypes from 'prop-types';
import { Popover, OverlayTrigger } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import CopyToClipboard from './CopyToClipboard';
import { getShortUrl } from '../utils/common';
import withToasts from '../messageToasts/enhancers/withToasts';

const propTypes = {
  url: PropTypes.string,
  emailSubject: PropTypes.string,
  emailContent: PropTypes.string,
  addDangerToast: PropTypes.func.isRequired,
};

class URLShortLinkButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      shortUrl: '',
    };
    this.onShortUrlSuccess = this.onShortUrlSuccess.bind(this);
    this.getCopyUrl = this.getCopyUrl.bind(this);
  }

  onShortUrlSuccess(shortUrl) {
    this.setState(() => ({
      shortUrl,
    }));
  }

  getCopyUrl() {
    getShortUrl(this.props.url).then(this.onShortUrlSuccess).catch(this.props.addDangerToast);
  }

  renderPopover() {
    const emailBody = t('%s%s', this.props.emailContent, this.state.shortUrl);
    return (
      <Popover id="shorturl-popover">
        <CopyToClipboard
          text={this.state.shortUrl}
          copyNode={<i className="fa fa-clipboard" title={t('Copy to clipboard')} />}
        />
        &nbsp;&nbsp;
        <a href={`mailto:?Subject=${this.props.emailSubject}%20&Body=${emailBody}`}>
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
        shouldUpdatePosition
        placement="left"
        onEnter={this.getCopyUrl}
        overlay={this.renderPopover()}
      >
        <span className="btn btn-default btn-sm" data-test="short-link-button">
          <i className="fa fa-link" />&nbsp;
        </span>
      </OverlayTrigger>
    );
  }
}

URLShortLinkButton.defaultProps = {
  url: window.location.href.substring(window.location.origin.length),
  emailSubject: '',
  emailContent: '',
};

URLShortLinkButton.propTypes = propTypes;

export default withToasts(URLShortLinkButton);

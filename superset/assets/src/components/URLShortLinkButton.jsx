import React from 'react';
import PropTypes from 'prop-types';
import { Popover, OverlayTrigger, Row, Col } from 'react-bootstrap';
import CopyToClipboard from './CopyToClipboard';
import { getShortUrl } from '../utils/common';
import { t } from '../locales';

const propTypes = {
  url: PropTypes.string,
  emailSubject: PropTypes.string,
  emailContent: PropTypes.string,
};

export default class URLShortLinkButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      shortUrl: '',
      name:''
    };
  }

  onShortUrlSuccess(data) {
    this.setState({
      shortUrl: data,
    });
  }

  handleInputChange(e) {
    const value = e.currentTarget.value;
    this.setState({"name": value});
  }

  getCopyUrl() {
    getShortUrl(this.props.url, this.onShortUrlSuccess.bind(this));
  }

  renderPopover() {
    let emailBody;
    let shortUrl;
    if(this.state.name != ''){
        emailBody = t('%s%s', this.props.emailContent, this.state.shortUrl + "/" + this.state.name);
        shortUrl = this.state.shortUrl + "/" + this.state.name;
    }else{
        emailBody = t('%s%s', this.props.emailContent, this.state.shortUrl);
        shortUrl = this.state.shortUrl;
    }
    return (
      <Popover id="shorturl-popover">
        <CopyToClipboard
          text={shortUrl}
          copyNode={<i className="fa fa-clipboard" title={t('Copy to clipboard')} />}
        />
        &nbsp;&nbsp;
        <a href={`mailto:?Subject=${this.props.emailSubject}%20&Body=${emailBody}`}>
          <i className="fa fa-envelope" />
        </a>
        <div className="form-group" style={{marginTop: '10px',width: '470px'}}>
          <Row>
            <Col md={3}>
                <small>
                  <label className="control-label" htmlFor="embed-height" style={{marginTop: '5px'}}>{t('Temporary Name')}</label>
                </small>
            </Col>
            <Col md={5}>
                <input
                  className="form-control input-sm"
                  type="text"
                  defaultValue={this.state.name}
                  name="height"
                  onChange={this.handleInputChange.bind(this)}
                />
            </Col>
            </Row>
         </div>
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

URLShortLinkButton.defaultProps = {
  url: window.location.href.substring(window.location.origin.length),
  emailSubject: '',
  emailContent: '',
};

URLShortLinkButton.propTypes = propTypes;

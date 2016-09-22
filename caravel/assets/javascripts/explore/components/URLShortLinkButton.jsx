import React, { PropTypes } from 'react';
import { Popover, OverlayTrigger } from 'react-bootstrap';
import CopyToClipboard from './../../components/CopyToClipboard';
import $ from 'jquery';

const propTypes = {
  slice: PropTypes.object.isRequired,
};

export default class URLShortLinkButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      shortUrl: '',
    };

    this.getShortUrl();
  }

  getShortUrl() {
    $.ajax({
      type: 'POST',
      url: '/r/shortner/',
      data: {
        data: '/' + window.location.pathname + this.props.slice.querystring(),
      },
      success: (data) => {
        this.setState({
          shortUrl: data,
        });
      },
      error: (error) => {
        /* eslint no-console: 0 */
        if (console && console.warn) {
          console.warn('Something went wrong...');
          console.warn(error);
        }
      },
    });
  }

  renderPopover() {
    return (
      <Popover id="shorturl-popover">
        <CopyToClipboard
          text={this.state.shortUrl}
          copyNode={<i className="fa fa-clipboard" title="Copy to clipboard"></i>}
        />
      </Popover>
    );
  }

  render() {
    const shortUrl = this.state.shortUrl;
    const isDisabled = shortUrl === '';
    return (
      <OverlayTrigger
        trigger="click"
        rootClose
        placement="left"
        overlay={this.renderPopover()}
      >
        <span className="btn btn-default btn-sm" disabled={isDisabled}>
          <i className="fa fa-link"></i>&nbsp;
        </span>
      </OverlayTrigger>
    );
  }
}

URLShortLinkButton.propTypes = propTypes;

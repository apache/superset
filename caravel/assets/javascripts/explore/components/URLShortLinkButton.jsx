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
  }

  getShortUrl() {
    $.ajax({
      type: 'POST',
      url: '/r/shortner/',
      data: {
        data: '/' + window.location.pathname + window.location.search,
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
    return (
      <OverlayTrigger
        trigger="click"
        rootClose
        placement="left"
        onEnter={this.getShortUrl.bind(this)}
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

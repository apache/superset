import React from 'react';
import PropTypes from 'prop-types';
import { Popover, OverlayTrigger } from 'react-bootstrap';
import CopyToClipboard from './../../components/CopyToClipboard';

const propTypes = {
  slice: PropTypes.object.isRequired,
};

export default class EmbedCodeButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      height: '400',
      width: '600',
    };
    this.handleInputChange = this.handleInputChange.bind(this);
  }

  handleInputChange(e) {
    const value = e.currentTarget.value;
    const name = e.currentTarget.name;
    const data = {};
    data[name] = value;
    this.setState(data);
  }

  generateEmbedHTML() {
    const srcLink = (
      window.location.origin +
      this.props.slice.data.standalone_endpoint +
      `&height=${this.state.height}`
    );
    return (
      '<iframe\n' +
      `  width="${this.state.width}"\n` +
      `  height="${this.state.height}"\n` +
      '  seamless\n' +
      '  frameBorder="0"\n' +
      '  scrolling="no"\n' +
      `  src="${srcLink}"\n` +
      '>\n' +
      '</iframe>'
    );
  }

  renderPopover() {
    const html = this.generateEmbedHTML();
    return (
      <Popover id="embed-code-popover">
        <div>
          <div className="row">
            <div className="col-sm-10">
              <textarea
                name="embedCode"
                value={html}
                rows="4"
                readOnly
                className="form-control input-sm"
              />
            </div>
            <div className="col-sm-2">
              <CopyToClipboard
                shouldShowText={false}
                text={html}
                copyNode={<i className="fa fa-clipboard" title="Copy to clipboard" />}
              />
            </div>
          </div>
          <br />
          <div className="row">
            <div className="col-md-6 col-sm-12">
              <div className="form-group">
                <small>
                  <label className="control-label" htmlFor="embed-height">Height</label>
                </small>
                <input
                  className="form-control input-sm"
                  type="text"
                  defaultValue={this.state.height}
                  name="height"
                  onChange={this.handleInputChange}
                />
              </div>
            </div>
            <div className="col-md-6 col-sm-12">
              <div className="form-group">
                <small>
                  <label className="control-label" htmlFor="embed-width">Width</label>
                </small>
                <input
                  className="form-control input-sm"
                  type="text"
                  defaultValue={this.state.width}
                  name="width"
                  onChange={this.handleInputChange}
                  id="embed-width"
                />
              </div>
            </div>
          </div>
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
        overlay={this.renderPopover()}
      >
        <span className="btn btn-default btn-sm">
          <i className="fa fa-code" />&nbsp;
        </span>
      </OverlayTrigger>
    );
  }
}

EmbedCodeButton.propTypes = propTypes;

import React, { PropTypes } from 'react';
import CopyToClipboard from './../../components/CopyToClipboard';
import { Popover, OverlayTrigger } from 'react-bootstrap';

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
    const srcLink = window.location.origin + this.props.slice.data.standalone_endpoint;
    /* eslint max-len: 0 */
    return `
      <iframe
        src="${srcLink}"
        width="${this.state.width}"
        height="${this.state.height}"
        seamless frameBorder="0" scrolling="no">
      </iframe>`;
  }

  renderPopover() {
    const html = this.generateEmbedHTML();
    return (
      <Popover id="embed-code-popover">
        <div>
          <div className="row">
            <div className="col-sm-10">
              <textarea name="embedCode" value={html} rows="4" readOnly className="form-control input-sm"></textarea>
            </div>
            <div className="col-sm-2">
              <CopyToClipboard
                shouldShowText={false}
                text={html}
                copyNode={<i className="fa fa-clipboard" title="Copy to clipboard"></i>}
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
          <i className="fa fa-code"></i>&nbsp;
        </span>
      </OverlayTrigger>
    );
  }
}

EmbedCodeButton.propTypes = propTypes;

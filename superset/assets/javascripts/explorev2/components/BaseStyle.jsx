import React from 'react';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  form_data: React.PropTypes.object.isRequired,
  baseStyle: React.PropTypes.object.isRequired,
};

export default class BaseStyle extends React.Component {
  changeHeaderValue(baseStyle, event) {
    this.props.actions.changeBaseStyle(baseStyle, 'headerValue', event.target.value);
  }
  changeBodyValue(baseStyle, event) {
    this.props.actions.changeBaseStyle(baseStyle, 'bodyValue', event.target.value);
  }
  render() {
    return (
      <div>
        <div className="col-lg-12">
          <div className="col-lg-2">
            <span>表头样式:</span>
          </div>
          <div className="col-lg-10">
            <input
              type="text"
              onChange={this.changeHeaderValue.bind(this, this.props.baseStyle)}
              value={this.props.baseStyle.headerValue}
              className="form-control input-sm"
              placeholder="表头样式"
            />
          </div>
        </div>

        <div className="col-lg-12" style={{ marginTop: '20px' }}>
          <div className="col-lg-2">
            <span>表样式:</span>
          </div>
          <div className="col-lg-10">
            <input
              type="text"
              onChange={this.changeBodyValue.bind(this, this.props.baseStyle)}
              value={this.props.baseStyle.bodyValue}
              className="form-control input-sm"
              placeholder="表样式"
            />
          </div>
        </div>
      </div>
    );
  }
}

BaseStyle.propTypes = propTypes;

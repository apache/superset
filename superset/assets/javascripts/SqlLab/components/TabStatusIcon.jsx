import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  onClose: PropTypes.func.isRequired,
  tabState: PropTypes.string.isRequired,
};

class TabStatusIcon extends React.Component {
  constructor(props) {
    super(props);
    this.onMouseOver = this.onMouseOver.bind(this);
    this.onMouseOut = this.onMouseOut.bind(this);

    this.state = { isHovered: false };
  }

  onMouseOver() {
    this.setState({ isHovered: true });
  }

  onMouseOut() {
    this.setState({ isHovered: false });
  }

  render() {
    return (
      <span
        onMouseOver={this.onMouseOver}
        onMouseOut={this.onMouseOut}
        onClick={this.props.onClose}
      >
        <div className={'circle ' + this.props.tabState}>
          {this.state.isHovered ? '×' : null}
        </div>
      </span>
    );
  }
}

TabStatusIcon.propTypes = propTypes;
export default TabStatusIcon;

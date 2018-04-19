import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  onClick: PropTypes.func.isRequired,
  className: PropTypes.string,
  label: PropTypes.string,
};

const defaultProps = {
  className: null,
  label: null,
};

export default class IconButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(event) {
    event.preventDefault();
    const { onClick } = this.props;
    onClick(event);
  }

  render() {
    const { className, label } = this.props;
    return (
      <div
        className="icon-button"
        onClick={this.handleClick}
        tabIndex="0"
        role="button"
      >
        <span className={className} />
        {label && <span className="icon-button-label">{label}</span>}
      </div>
    );
  }
}

IconButton.propTypes = propTypes;
IconButton.defaultProps = defaultProps;

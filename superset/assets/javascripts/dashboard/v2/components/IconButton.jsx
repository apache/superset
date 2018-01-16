import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

const propTypes = {
  onClick: PropTypes.func.isRequired,
  className: PropTypes.string,
};

const defaultProps = {
  className: null,
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
    const { className } = this.props;
    return (
      <div
        className={cx('icon-button', className)}
        onClick={this.handleClick}
        tabIndex="0"
        role="button"
      />
    );
  }
}

IconButton.propTypes = propTypes;
IconButton.defaultProps = defaultProps;

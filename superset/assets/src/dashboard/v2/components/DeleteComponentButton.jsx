import React from 'react';
import PropTypes from 'prop-types';

import IconButton from './IconButton';

const propTypes = {
  onDelete: PropTypes.func.isRequired,
};

const defaultProps = {};

export default class DeleteComponentButton extends React.PureComponent {
  render() {
    const { onDelete } = this.props;
    return <IconButton onClick={onDelete} className="fa fa-trash" />;
  }
}

DeleteComponentButton.propTypes = propTypes;
DeleteComponentButton.defaultProps = defaultProps;

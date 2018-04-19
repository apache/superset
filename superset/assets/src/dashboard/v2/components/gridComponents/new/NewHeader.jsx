import React from 'react';
// import PropTypes from 'prop-types';

import { HEADER_TYPE } from '../../../util/componentTypes';
import { NEW_HEADER_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';

const propTypes = {
};

export default class DraggableNewHeader extends React.Component {
  render() {
    return (
      <DraggableNewComponent
        id={NEW_HEADER_ID}
        type={HEADER_TYPE}
        label="Header"
        className="fa fa-header"
      />
    );
  }
}

DraggableNewHeader.propTypes = propTypes;

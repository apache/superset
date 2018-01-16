import React from 'react';
// import PropTypes from 'prop-types';

import { COLUMN_TYPE } from '../../../util/componentTypes';
import { NEW_COLUMN_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';

const propTypes = {
};

export default class DraggableNewColumn extends React.PureComponent {
  render() {
    return (
      <DraggableNewComponent
        id={NEW_COLUMN_ID}
        type={COLUMN_TYPE}
        label="Column"
        className="fa fa-long-arrow-down"
      />
    );
  }
}

DraggableNewColumn.propTypes = propTypes;

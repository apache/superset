import React from 'react';
// import PropTypes from 'prop-types';

import { DIVIDER_TYPE } from '../../../util/componentTypes';
import { NEW_DIVIDER_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';

const propTypes = {
};

export default class DraggableNewDivider extends React.PureComponent {
  render() {
    return (
      <DraggableNewComponent
        id={NEW_DIVIDER_ID}
        type={DIVIDER_TYPE}
        label="Divider"
        className="divider-placeholder"
      />
    );
  }
}

DraggableNewDivider.propTypes = propTypes;

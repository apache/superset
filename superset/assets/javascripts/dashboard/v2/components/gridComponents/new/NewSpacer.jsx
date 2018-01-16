import React from 'react';
// import PropTypes from 'prop-types';

import { SPACER_TYPE } from '../../../util/componentTypes';
import { NEW_SPACER_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';

const propTypes = {
};

export default class DraggableNewChart extends React.PureComponent {
  render() {
    return (
      <DraggableNewComponent
        id={NEW_SPACER_ID}
        type={SPACER_TYPE}
        label="Spacer"
        className="spacer-placeholder fa fa-arrows"
      />
    );
  }
}

DraggableNewChart.propTypes = propTypes;

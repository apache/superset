import React from 'react';
// import PropTypes from 'prop-types';

import { TABS_TYPE } from '../../../util/componentTypes';
import { NEW_TABS_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';

const propTypes = {
};

export default class DraggableNewTabs extends React.PureComponent {
  render() {
    return (
      <DraggableNewComponent
        id={NEW_TABS_ID}
        type={TABS_TYPE}
        label="Tabs"
        className="fa fa-window-restore"
      />
    );
  }
}

DraggableNewTabs.propTypes = propTypes;

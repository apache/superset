import React from 'react';
import PropTypes from 'prop-types';

import getDragDropManager from '../../../../src/dashboard/util/getDragDropManager';

// A helper component that provides a DragDropContext for components that require it
class WithDragDropContext extends React.Component {
  getChildContext() {
    return {
      dragDropManager: this.context.dragDropManager || getDragDropManager(),
    };
  }

  render() {
    return this.props.children;
  }
}

WithDragDropContext.propTypes = {
  children: PropTypes.node.isRequired,
};

WithDragDropContext.childContextTypes = {
  dragDropManager: PropTypes.object.isRequired,
};

export default WithDragDropContext;

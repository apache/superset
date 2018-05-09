import React from 'react';
import PropTypes from 'prop-types';
import { DragDropContext } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

class WithDragDropContext extends React.Component {
  render() {
    return this.props.children;
  }
}

WithDragDropContext.propTypes = {
  children: PropTypes.node.isRequired,
};

export default DragDropContext(HTML5Backend)(WithDragDropContext);

import React from 'react';
import PropTypes from 'prop-types';

import DragDroppable from '../dnd/DragDroppable';
import HoverMenu from '../menu/HoverMenu';
import DeleteComponentButton from '../DeleteComponentButton';
import { componentShape } from '../../util/propShapes';

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  depth: PropTypes.number.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  editMode: PropTypes.bool.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
};

class Divider extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
  }

  handleDeleteComponent() {
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  render() {
    const {
      component,
      depth,
      parentComponent,
      index,
      handleComponentDrop,
      editMode,
    } = this.props;

    return (
      <DragDroppable
        component={component}
        parentComponent={parentComponent}
        orientation="row"
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
        editMode={editMode}
      >
        {({ dropIndicatorProps, dragSourceRef }) => (
          <div ref={dragSourceRef}>
            {editMode && (
              <HoverMenu position="left">
                <DeleteComponentButton onDelete={this.handleDeleteComponent} />
              </HoverMenu>
            )}

            <div className="dashboard-component dashboard-component-divider" />

            {dropIndicatorProps && <div {...dropIndicatorProps} />}
          </div>
        )}
      </DragDroppable>
    );
  }
}

Divider.propTypes = propTypes;

export default Divider;

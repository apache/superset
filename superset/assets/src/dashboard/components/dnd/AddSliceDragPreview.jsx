import React from 'react';
import PropTypes from 'prop-types';
import { DragLayer } from 'react-dnd';

import AddSliceCard from '../AddSliceCard';
import { slicePropShape } from '../../util/propShapes';
import {
  NEW_COMPONENT_SOURCE_TYPE,
  CHART_TYPE,
} from '../../util/componentTypes';

const staticCardStyles = {
  position: 'fixed',
  background: 'rgba(255, 255, 255, 0.7)',
  pointerEvents: 'none',
  top: 0,
  left: 0,
  zIndex: 101, // this should be higher than top-level tabs
  width: 376 - 2 * 16,
};

const propTypes = {
  dragItem: PropTypes.shape({
    index: PropTypes.number.isRequired,
  }),
  slices: PropTypes.arrayOf(slicePropShape),
  isDragging: PropTypes.bool.isRequired,
  currentOffset: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }),
};

const defaultProps = {
  currentOffset: null,
  dragItem: null,
  slices: null,
};

function AddSliceDragPreview({ dragItem, slices, isDragging, currentOffset }) {
  if (!isDragging || !currentOffset || !dragItem || !slices) return null;

  const slice = slices[dragItem.index];

  // make sure it's a new component and a chart
  const shouldRender =
    slice &&
    dragItem.parentType === NEW_COMPONENT_SOURCE_TYPE &&
    dragItem.type === CHART_TYPE;

  return !shouldRender ? null : (
    <AddSliceCard
      style={{
        ...staticCardStyles,
        transform: `translate(${currentOffset.x}px, ${currentOffset.y}px)`,
      }}
      sliceName={slice.slice_name}
      lastModified={
        slice.modified ? slice.modified.replace(/<[^>]*>/g, '') : ''
      }
      visType={slice.viz_type}
      datasourceLink={slice.datasource_link}
    />
  );
}

AddSliceDragPreview.propTypes = propTypes;
AddSliceDragPreview.defaultProps = defaultProps;

// This injects these props into the component
export default DragLayer(monitor => ({
  dragItem: monitor.getItem(),
  currentOffset: monitor.getSourceClientOffset(),
  isDragging: monitor.isDragging(),
}))(AddSliceDragPreview);

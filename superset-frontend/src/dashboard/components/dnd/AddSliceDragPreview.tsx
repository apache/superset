/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useDragLayer } from 'react-dnd';
import { Slice } from 'src/dashboard/types';
import AddSliceCard from '../AddSliceCard';
import {
  NEW_COMPONENT_SOURCE_TYPE,
  CHART_TYPE,
} from '../../util/componentTypes';

interface DragItem {
  index: number;
  parentType: string;
  type: string;
}

interface AddSliceDragPreviewProps {
  slices: Slice[] | null;
}

const staticCardStyles: React.CSSProperties = {
  position: 'fixed',
  pointerEvents: 'none',
  top: 0,
  left: 0,
  zIndex: 101, // this should be higher than top-level tabs
  width: 376 - 2 * 16,
};

const AddSliceDragPreview: React.FC<AddSliceDragPreviewProps> = ({
  slices,
}) => {
  const { dragItem, isDragging, currentOffset } = useDragLayer(
    (monitor: any) => ({
      dragItem: monitor.getItem() as DragItem | null,
      currentOffset: monitor.getSourceClientOffset(),
      isDragging: monitor.isDragging(),
    }),
  );
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
      lastModified={slice.changed_on_humanized}
      visType={slice.viz_type}
      datasourceUrl={slice.datasource_url}
      datasourceName={slice.datasource_name}
    />
  );
};

export default AddSliceDragPreview;

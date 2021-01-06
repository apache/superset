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
import React from 'react';
import { findDOMNode } from 'react-dom';
// Current version of react-dnd (2.5.4) doesn't work well with typescript
// TODO: remove ts-ignore after we upgrade react-dnd
// @ts-ignore
import { DragSource, DropTarget } from 'react-dnd';
import { styled, useTheme } from '@superset-ui/core';
import { ColumnOption } from '@superset-ui/chart-controls';
import Icon from '../../components/Icon';
import { savedMetricType } from '../types';

const TYPE = 'label-dnd';

const DragContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
  :last-child {
    margin-bottom: 0;
  }
`;

const OptionControlContainer = styled.div<{
  isAdhoc?: boolean;
}>`
  display: flex;
  align-items: center;
  width: 100%;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  height: ${({ theme }) => theme.gridUnit * 6}px;
  background-color: ${({ theme }) => theme.colors.grayscale.light3};
  border-radius: 3px;
  cursor: ${({ isAdhoc }) => (isAdhoc ? 'pointer' : 'default')};
`;

const Label = styled.div`
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  align-items: center;
  white-space: nowrap;
  padding-left: ${({ theme }) => theme.gridUnit}px;
  svg {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

const CaretContainer = styled.div`
  height: 100%;
  border-left: solid 1px ${({ theme }) => theme.colors.grayscale.dark2}0C;
  margin-left: auto;
`;

const CloseContainer = styled.div`
  height: 100%;
  width: ${({ theme }) => theme.gridUnit * 6}px;
  border-right: solid 1px ${({ theme }) => theme.colors.grayscale.dark2}0C;
  cursor: pointer;
`;

export const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const LabelsContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit}px;
  border: solid 1px ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: 3px;
`;

export const AddControlLabel = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  height: ${({ theme }) => theme.gridUnit * 6}px;
  padding-left: ${({ theme }) => theme.gridUnit}px;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
  border: dashed 1px ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: 3px;
  cursor: pointer;

  :hover {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
  }

  :active {
    background-color: ${({ theme }) => theme.colors.grayscale.light3};
  }
`;

export const AddIconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  height: ${({ theme }) => theme.gridUnit * 4}px;
  width: ${({ theme }) => theme.gridUnit * 4}px;
  padding: 0;
  background-color: ${({ theme }) => theme.colors.primary.dark1};
  border: none;
  border-radius: 2px;

  :disabled {
    cursor: not-allowed;
    background-color: ${({ theme }) => theme.colors.grayscale.light1};
  }
`;

const labelSource = {
  beginDrag({ index, type }: { index: number; type: string }) {
    return {
      index,
      type,
    };
  },
};

const labelTarget = {
  hover(props: Record<string, any>, monitor: any, component: any) {
    const { index: dragIndex, type: dragType } = monitor.getItem();
    const { index: hoverIndex, type: hoverType } = props;

    // Don't replace items with themselves
    // Don't allow to drag items between filters and metrics boxes
    if (dragIndex === hoverIndex || dragType !== hoverType) {
      return;
    }

    // Determine rectangle on screen
    // TODO: refactor with references when we upgrade react-dnd
    // For now we disable warnings about findDOMNode, but we should refactor after we upgrade react-dnd
    // Current version (2.5.4) doesn't work well with refs
    // @ts-ignore
    // eslint-disable-next-line react/no-find-dom-node
    const hoverBoundingRect = findDOMNode(component)?.getBoundingClientRect();

    // Get vertical middle
    const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

    // Determine mouse position
    const clientOffset = monitor.getClientOffset();

    // Get pixels to the top
    const hoverClientY = clientOffset.y - hoverBoundingRect.top;

    // Only perform the move when the mouse has crossed half of the items height
    // When dragging downwards, only move when the cursor is below 50%
    // When dragging upwards, only move when the cursor is above 50%

    // Dragging downwards
    if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
      return;
    }

    // Dragging upwards
    if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
      return;
    }

    // Time to actually perform the action
    props.onMoveLabel?.(dragIndex, hoverIndex);

    // Note: we're mutating the monitor item here!
    // Generally it's better to avoid mutations,
    // but it's good here for the sake of performance
    // to avoid expensive index searches.
    // eslint-disable-next-line no-param-reassign
    monitor.getItem().index = hoverIndex;
  },
  drop(props: Record<string, any>) {
    return props.onDropLabel?.();
  },
};

export const OptionControlLabel = ({
  label,
  savedMetric,
  onRemove,
  isAdhoc,
  isFunction,
  isDraggable,
  connectDragSource,
  connectDropTarget,
  ...props
}: {
  label: string | React.ReactNode;
  savedMetric?: savedMetricType;
  onRemove: () => void;
  isAdhoc?: boolean;
  isFunction?: boolean;
  isDraggable?: boolean;
  connectDragSource?: any;
  connectDropTarget?: any;
}) => {
  const theme = useTheme();
  const getLabelContent = () => {
    if (savedMetric?.metric_name) {
      // add column_name to fix typescript error
      const column = { ...savedMetric, column_name: '' };
      if (!column.verbose_name) {
        column.verbose_name = column.metric_name;
      }
      return <ColumnOption column={column} />;
    }
    return label;
  };

  const getOptionControlContent = () => (
    <OptionControlContainer
      isAdhoc={isAdhoc}
      data-test="option-label"
      {...props}
    >
      <CloseContainer
        role="button"
        data-test="remove-control-button"
        onClick={onRemove}
      >
        <Icon name="x-small" color={theme.colors.grayscale.light1} />
      </CloseContainer>
      <Label data-test="control-label">
        {isFunction && <Icon name="function" viewBox="0 0 16 11" />}
        {getLabelContent()}
      </Label>
      {isAdhoc && (
        <CaretContainer>
          <Icon name="caret-right" color={theme.colors.grayscale.light1} />
        </CaretContainer>
      )}
    </OptionControlContainer>
  );

  return (
    <DragContainer>
      {isDraggable
        ? connectDragSource(
            connectDropTarget(<div>{getOptionControlContent()}</div>),
          )
        : getOptionControlContent()}
    </DragContainer>
  );
};

export const DraggableOptionControlLabel = DropTarget(
  TYPE,
  labelTarget,
  (connect: any) => ({
    connectDropTarget: connect.dropTarget(),
  }),
)(
  DragSource(TYPE, labelSource, (connect: any) => ({
    connectDragSource: connect.dragSource(),
    isDraggable: true,
  }))(OptionControlLabel),
);

DraggableOptionControlLabel.displayName = 'DraggableOptionControlLabel';

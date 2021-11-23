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
import React, { useRef } from 'react';
import { useDrag, useDrop, DropTargetMonitor } from 'react-dnd';
import { styled, t, useTheme } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import { savedMetricType } from 'src/explore/components/controls/MetricControl/types';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import { StyledMetricOption } from '../../optionRenderers';

export const DragContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
  :last-child {
    margin-bottom: 0;
  }
`;

export const OptionControlContainer = styled.div<{
  withCaret?: boolean;
}>`
  display: flex;
  align-items: center;
  width: 100%;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  height: ${({ theme }) => theme.gridUnit * 6}px;
  background-color: ${({ theme }) => theme.colors.grayscale.light3};
  border-radius: 3px;
  cursor: ${({ withCaret }) => (withCaret ? 'pointer' : 'default')};
`;
export const Label = styled.div`
  ${({ theme }) => `
    display: flex;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    align-items: center;
    white-space: nowrap;
    padding-left: ${theme.gridUnit}px;
    svg {
      margin-right: ${theme.gridUnit}px;
      margin-left: ${theme.gridUnit}px;
    }
    .type-label {
      margin-right: ${theme.gridUnit * 2}px;
      margin-left: ${theme.gridUnit}px;
      font-weight: ${theme.typography.weights.normal};
      width: auto;
    }
    .option-label {
      display: inline;
    }
  `}
`;

const LabelText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const CaretContainer = styled.div`
  height: 100%;
  border-left: solid 1px ${({ theme }) => theme.colors.grayscale.dark2}0C;
  margin-left: auto;
`;

export const CloseContainer = styled.div`
  height: 100%;
  width: ${({ theme }) => theme.gridUnit * 6}px;
  border-right: solid 1px ${({ theme }) => theme.colors.grayscale.dark2}0C;
  cursor: pointer;
`;

const StyledInfoTooltipWithTrigger = styled(InfoTooltipWithTrigger)`
  margin: 0 ${({ theme }) => theme.gridUnit}px;
`;

export const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const LabelsContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit}px;
  border: solid 1px ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.gridUnit}px;
`;

export const DndLabelsContainer = styled.div<{
  canDrop?: boolean;
  isOver?: boolean;
}>`
  padding: ${({ theme }) => theme.gridUnit}px;
  border: ${({ canDrop, isOver, theme }) => {
    if (canDrop) {
      return `dashed 1px ${theme.colors.info.dark1}`;
    }
    if (isOver && !canDrop) {
      return `dashed 1px ${theme.colors.error.dark1}`;
    }
    return `solid 1px ${theme.colors.grayscale.light2}`;
  }};
  border-radius: ${({ theme }) => theme.gridUnit}px;
`;

export const AddControlLabel = styled.div<{
  cancelHover?: boolean;
}>`
  display: flex;
  align-items: center;
  width: 100%;
  height: ${({ theme }) => theme.gridUnit * 6}px;
  padding-left: ${({ theme }) => theme.gridUnit}px;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
  border: dashed 1px ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.gridUnit}px;
  cursor: ${({ cancelHover }) => (cancelHover ? 'inherit' : 'pointer')};

  :hover {
    background-color: ${({ cancelHover, theme }) =>
      cancelHover ? 'inherit' : theme.colors.grayscale.light4};
  }

  :active {
    background-color: ${({ cancelHover, theme }) =>
      cancelHover ? 'inherit' : theme.colors.grayscale.light3};
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

interface DragItem {
  index: number;
  type: string;
}

export const OptionControlLabel = ({
  label,
  savedMetric,
  adhocMetric,
  onRemove,
  onMoveLabel,
  onDropLabel,
  withCaret,
  isFunction,
  type,
  index,
  isExtra,
  tooltipTitle,
  multi = true,
  ...props
}: {
  label: string | React.ReactNode;
  savedMetric?: savedMetricType;
  adhocMetric?: AdhocMetric;
  onRemove: () => void;
  onMoveLabel: (dragIndex: number, hoverIndex: number) => void;
  onDropLabel: () => void;
  withCaret?: boolean;
  isFunction?: boolean;
  isDraggable?: boolean;
  type: string;
  index: number;
  isExtra?: boolean;
  tooltipTitle: string;
  multi?: boolean;
}) => {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const hasMetricName = savedMetric?.metric_name;
  const [, drop] = useDrop({
    accept: type,
    drop() {
      if (!multi) {
        return;
      }
      onDropLabel?.();
    },
    hover(item: DragItem, monitor: DropTargetMonitor) {
      if (!multi) {
        return;
      }
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;
      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }
      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      // Get pixels to the top
      const hoverClientY = clientOffset?.y
        ? clientOffset?.y - hoverBoundingRect.top
        : 0;
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
      onMoveLabel?.(dragIndex, hoverIndex);
      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      // eslint-disable-next-line no-param-reassign
      item.index = hoverIndex;
    },
  });
  const [{ isDragging }, drag] = useDrag({
    item: {
      type,
      index,
      value: savedMetric?.metric_name ? savedMetric : adhocMetric,
    },
    collect: monitor => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const getLabelContent = () => {
    const shouldShowTooltip =
      (!isDragging &&
        typeof label === 'string' &&
        tooltipTitle &&
        label &&
        tooltipTitle !== label) ||
      (!isDragging &&
        labelRef &&
        labelRef.current &&
        labelRef.current.scrollWidth > labelRef.current.clientWidth);

    if (savedMetric && hasMetricName) {
      return (
        <StyledMetricOption
          metric={savedMetric}
          labelRef={labelRef}
          showTooltip={!!shouldShowTooltip}
        />
      );
    }
    if (!shouldShowTooltip) {
      return <LabelText ref={labelRef}>{label}</LabelText>;
    }
    return (
      <Tooltip title={tooltipTitle || label}>
        <LabelText ref={labelRef}>{label}</LabelText>
      </Tooltip>
    );
  };

  const getOptionControlContent = () => (
    <OptionControlContainer
      withCaret={withCaret}
      data-test="option-label"
      {...props}
    >
      <CloseContainer
        role="button"
        data-test="remove-control-button"
        onClick={onRemove}
      >
        <Icons.XSmall iconColor={theme.colors.grayscale.light1} />
      </CloseContainer>
      <Label data-test="control-label">
        {isFunction && <Icons.FunctionX viewBox="0 0 16 11" iconSize="l" />}
        {getLabelContent()}
      </Label>
      {isExtra && (
        <StyledInfoTooltipWithTrigger
          icon="exclamation-triangle"
          placement="top"
          bsStyle="warning"
          tooltip={t(`
                This filter was inherited from the dashboard's context.
                It won't be saved when saving the chart.
              `)}
        />
      )}
      {withCaret && (
        <CaretContainer>
          <Icons.CaretRight iconColor={theme.colors.grayscale.light1} />
        </CaretContainer>
      )}
    </OptionControlContainer>
  );

  drag(drop(ref));
  return <DragContainer ref={ref}>{getOptionControlContent()}</DragContainer>;
};

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
import { useRef, ReactNode } from 'react';

import { useDrag, useDrop, DropTargetMonitor } from 'react-dnd';
import { styled, t, useTheme, keyframes, css } from '@superset-ui/core';
import { InfoTooltip, Icons, Tooltip } from '@superset-ui/core/components';
import { savedMetricType } from 'src/explore/components/controls/MetricControl/types';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import { StyledMetricOption } from '../../optionRenderers';

export const DragContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
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
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  height: ${({ theme }) => theme.sizeUnit * 6}px;
  background-color: ${({ theme }) => theme.colorBgLayout};
  border-radius: 3px;
  cursor: ${({ withCaret }) => (withCaret ? 'pointer' : 'default')};
  :hover {
    background-color: ${({ theme }) => theme.colorPrimaryBgHover};
  }
`;
export const Label = styled.div`
  ${({ theme }) => `
    display: flex;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    align-items: center;
    white-space: nowrap;
    padding-left: ${theme.sizeUnit}px;
    svg {
      margin-right: ${theme.sizeUnit}px;
    }
    .type-label {
      margin-right: ${theme.sizeUnit * 2}px;
      margin-left: ${theme.sizeUnit}px;
      font-weight: ${theme.fontWeightNormal};
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
  border-left: solid 1px ${({ theme }) => theme.colorSplit};
  margin-left: auto;
`;

export const CloseContainer = styled.div`
  height: auto;
  width: ${({ theme }) => theme.sizeUnit * 6}px;
  border-right: solid 1px ${({ theme }) => theme.colorBorder};
  cursor: pointer;
`;

const StyledInfoTooltip = styled(InfoTooltip)`
  margin: 0 ${({ theme }) => theme.sizeUnit}px;
`;

export const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const LabelsContainer = styled.div`
  padding: ${({ theme }) => theme.sizeUnit}px;
  border: solid 1px ${({ theme }) => theme.colorSplit};
  border-radius: ${({ theme }) => theme.borderRadius}px;
`;

const borderPulse = keyframes`
  0% {
    right: 100%;
  }
  50% {
    left: 4px;
  }
  90% {
    right: 4px;
  }
  100% {
    left: 100%;
  }
`;

export const DndLabelsContainer = styled.div<{
  canDrop?: boolean;
  isOver?: boolean;
  isDragging?: boolean;
  isLoading?: boolean;
}>`
  ${({ theme, isLoading, canDrop, isDragging, isOver }) => `
  position: relative;
  padding: ${theme.sizeUnit}px;
  border: ${
    !isLoading && isDragging
      ? `dashed 1px ${canDrop ? theme.colorSplit : theme.colorErrorBgHover}`
      : `solid 1px ${
          isLoading && isDragging
            ? theme.colorWarningBgHover
            : theme.colorBorder
        }`
  };
  border-radius: ${theme.borderRadius}px;
  &:before,
  &:after {
    content: ' ';
    position: absolute;
    border-radius: ${theme.borderRadius}px;
  }
  &:before {
    display: ${isDragging || isLoading ? 'block' : 'none'};
    background-color: ${canDrop ? theme.colorPrimary : theme.colorErrorBgHover};
    z-index: 10;
    opacity: 10%;
    top: 1px;
    right: 1px;
    bottom: 1px;
    left: 1px;
  }
  &:after {
    display: ${isLoading || (canDrop && isOver) ? 'block' : 'none'};
    background-color: ${
      isLoading ? theme.colorFillTertiary : theme.colorPrimary
    };
    z-index: 11;
    opacity: 35%;
    top: ${-theme.sizeUnit}px;
    right: ${-theme.sizeUnit}px;
    bottom: ${-theme.sizeUnit}px;
    left: ${-theme.sizeUnit}px;
    cursor: ${isLoading ? 'wait' : 'auto'};
  }
  `}

  &:before {
    ${({ theme, isLoading }) =>
      isLoading &&
      css`
        animation: ${borderPulse} 2s ease-in infinite;
        background: linear-gradient(currentColor 0 0) 0 100%/0% 3px no-repeat;
        background-size: 100% ${theme.sizeUnit / 2}px;
        top: auto;
        right: ${theme.sizeUnit}px;
        left: ${theme.sizeUnit}px;
        bottom: -${theme.sizeUnit / 2}px;
        height: ${theme.sizeUnit / 2}px;
      `};
  }
`;

export const AddControlLabel = styled.div<{
  cancelHover?: boolean;
}>`
  display: flex;
  align-items: center;
  width: 100%;
  height: ${({ theme }) => theme.sizeUnit * 6}px;
  padding-left: ${({ theme }) => theme.sizeUnit}px;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorTextSecondary};
  border: dashed 1px ${({ theme }) => theme.colorSplit};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  cursor: ${({ cancelHover }) => (cancelHover ? 'inherit' : 'pointer')};

  :hover {
    background-color: ${({ cancelHover, theme }) =>
      cancelHover ? 'inherit' : theme.colorFillSecondary};
  }

  :active {
    background-color: ${({ cancelHover, theme }) =>
      cancelHover ? 'inherit' : theme.colorFillTertiary};
  }
  svg {
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

export const AddIconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  height: ${({ theme }) => theme.sizeUnit * 4}px;
  width: ${({ theme }) => theme.sizeUnit * 4}px;
  padding: 0;
  background-color: ${({ theme }) => theme.colorPrimaryText};
  border: none;
  border-radius: 2px;
  cursor: pointer;

  :disabled {
    cursor: not-allowed;
    background-color: ${({ theme }) => theme.colorBgContainerDisabled};
  }
`;

interface DragItem {
  dragIndex: number;
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
  datasourceWarningMessage,
  tooltipTitle,
  multi = true,
  ...props
}: {
  label: string | ReactNode;
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
  datasourceWarningMessage?: string;
  tooltipTitle?: string;
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
      const { dragIndex } = item;
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
      item.dragIndex = hoverIndex;
    },
  });
  const [{ isDragging }, drag] = useDrag({
    item: {
      type,
      dragIndex: index,
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
          shouldShowTooltip={!isDragging}
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
      css={css`
        text-align: center;
      `}
    >
      <CloseContainer
        role="button"
        data-test="remove-control-button"
        onClick={onRemove}
      >
        <Icons.CloseOutlined
          iconSize="m"
          iconColor={theme.colorIcon}
          css={css`
            vertical-align: sub;
          `}
        />
      </CloseContainer>
      <Label data-test="control-label">
        {isFunction && <Icons.FunctionOutlined iconSize="m" />}
        {getLabelContent()}
      </Label>
      {(!!datasourceWarningMessage || isExtra) && (
        <StyledInfoTooltip
          type="warning"
          placement="top"
          tooltip={
            datasourceWarningMessage ||
            t(`
                This filter was inherited from the dashboard's context.
                It won't be saved when saving the chart.
              `)
          }
        />
      )}
      {withCaret && (
        <CaretContainer>
          <Icons.RightOutlined
            iconSize="m"
            css={css`
              margin: ${theme.sizeUnit}px;
            `}
            iconColor={theme.colorIcon}
          />
        </CaretContainer>
      )}
    </OptionControlContainer>
  );

  drag(drop(ref));
  return <DragContainer ref={ref}>{getOptionControlContent()}</DragContainer>;
};

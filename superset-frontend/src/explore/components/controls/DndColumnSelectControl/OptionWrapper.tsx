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
import { useRef, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DragContainer } from 'src/explore/components/controls/OptionControls';
import {
  OptionProps,
  OptionItemInterface,
} from 'src/explore/components/controls/DndColumnSelectControl/types';
import { Tooltip } from '@superset-ui/core/components';
import { StyledColumnOption } from 'src/explore/components/optionRenderers';
import { isAdhocColumn } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import { ColumnMeta } from '@superset-ui/chart-controls';
import Option from './Option';

export const OptionLabel = styled.div`
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export default function OptionWrapper(
  props: OptionProps & {
    type: string;
    onShiftOptions: (dragIndex: number, hoverIndex: number) => void;
  },
) {
  const {
    index,
    label,
    tooltipTitle,
    column,
    type,
    onShiftOptions,
    clickClose,
    withCaret,
    isExtra,
    datasourceWarningMessage,
    canDelete = true,
    tooltipOverlay,
    multiValueWarningMessage,
    ...rest
  } = props;
  const labelRef = useRef<HTMLDivElement>(null);

  // Create a unique sortable ID for this item
  const sortableId = useMemo(() => `sortable-${type}-${index}`, [type, index]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    data: {
      type,
      dragIndex: index,
      onShiftOptions,
    } as OptionItemInterface & { onShiftOptions: typeof onShiftOptions },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const shouldShowTooltip =
    (!isDragging && tooltipTitle && label && tooltipTitle !== label) ||
    (!isDragging &&
      labelRef &&
      labelRef.current &&
      labelRef.current.scrollWidth > labelRef.current.clientWidth) ||
    (!isDragging && tooltipOverlay);

  const LabelContent = () => {
    if (!shouldShowTooltip) {
      return <span>{label}</span>;
    }
    if (tooltipOverlay) {
      return (
        <Tooltip overlay={tooltipOverlay}>
          <span>{label}</span>
        </Tooltip>
      );
    }
    return (
      <Tooltip title={tooltipTitle || label}>
        <span>{label}</span>
      </Tooltip>
    );
  };

  const ColumnOption = () => {
    const transformedCol =
      column && isAdhocColumn(column)
        ? { verbose_name: column.label, expression: column.sqlExpression }
        : column;
    return (
      <StyledColumnOption
        column={transformedCol as ColumnMeta}
        labelRef={labelRef}
        showType
      />
    );
  };

  const Label = () => {
    if (label) {
      return (
        <OptionLabel ref={labelRef}>
          <LabelContent />
        </OptionLabel>
      );
    }
    if (column) {
      return (
        <OptionLabel>
          <ColumnOption />
        </OptionLabel>
      );
    }
    return null;
  };

  return (
    <DragContainer
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      {...rest}
    >
      <Option
        index={index}
        clickClose={clickClose}
        withCaret={withCaret}
        isExtra={isExtra}
        datasourceWarningMessage={datasourceWarningMessage}
        canDelete={canDelete}
        multiValueWarningMessage={multiValueWarningMessage}
      >
        <Label />
      </Option>
    </DragContainer>
  );
}

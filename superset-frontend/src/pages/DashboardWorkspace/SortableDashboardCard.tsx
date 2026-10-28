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
import { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components';

const Row = styled.div<{ $dragging?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.sizeUnit}px;
  opacity: ${({ $dragging }) => ($dragging ? 0.85 : 1)};
`;

const DragHandle = styled.button`
  flex-shrink: 0;
  margin-top: ${({ theme }) => theme.sizeUnit * 3}px;
  appearance: none;
  border: none;
  background: transparent;
  padding: ${({ theme }) => theme.sizeUnit}px;
  cursor: grab;
  color: ${({ theme }) => theme.colorTextSecondary};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  &:hover {
    color: ${({ theme }) => theme.colorText};
    background: ${({ theme }) => theme.colorFillSecondary};
  }
  &:active {
    cursor: grabbing;
  }
`;

const CardWrap = styled.div`
  flex: 1;
  min-width: 0;
`;

type Props = {
  id: string;
  disabled?: boolean;
  children: ReactNode;
};

export default function SortableDashboardCard({
  id,
  disabled,
  children,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Row ref={setNodeRef} style={style} $dragging={isDragging}>
      {!disabled && (
        <DragHandle
          type="button"
          aria-label="Reorder dashboard"
          data-test="dashboard-workspace-drag-handle"
          {...attributes}
          {...listeners}
        >
          <Icons.Drag iconSize="m" />
        </DragHandle>
      )}
      <CardWrap>{children}</CardWrap>
    </Row>
  );
}

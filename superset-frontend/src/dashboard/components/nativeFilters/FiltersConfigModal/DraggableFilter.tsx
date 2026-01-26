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
import { styled } from '@apache-superset/core/ui';
import { FC } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icons } from '@superset-ui/core/components/Icons';
import type { IconType } from '@superset-ui/core/components/Icons/types';
import { isDivider } from './utils';

interface TitleContainerProps {
  readonly isDragging: boolean;
}

export const FILTER_TYPE = 'FILTER';
export const CUSTOMIZATION_TYPE = 'CUSTOMIZATION';

const Container = styled.div<TitleContainerProps>`
  ${({ isDragging }) => `
    opacity: ${isDragging ? 0.3 : 1};
    cursor: ${isDragging ? 'grabbing' : 'pointer'};
    width: 100%;
    display: flex;
  `}
`;

const DragIcon = styled(Icons.Drag, {
  shouldForwardProp: propName => propName !== 'isDragging',
})<IconType & { isDragging: boolean }>`
  ${({ isDragging, theme }) => `
    font-size: ${theme.fontSize}px;
    cursor: ${isDragging ? 'grabbing' : 'grab'};
    padding-left: ${theme.sizeUnit}px;
  `}
`;

interface FilterTabTitleProps {
  id: string;
  index: number;
  filterIds: string[];
  dragType?: string;
  children: React.ReactNode;
}

export const DraggableFilter: FC<FilterTabTitleProps> = ({
  id,
  index,
  filterIds,
  dragType = FILTER_TYPE,
  children,
}) => {
  const itemId = filterIds[0];
  const isDividerItem = isDivider(itemId);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      filterIds,
      index,
      isDivider: isDividerItem,
      dragType,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Container isDragging={isDragging}>
        <DragIcon
          {...attributes}
          {...listeners}
          isDragging={isDragging}
          alt="Move icon"
          viewBox="4 4 16 16"
        />
        <div css={{ flex: 1 }}>{children}</div>
      </Container>
    </div>
  );
};

export default DraggableFilter;

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
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';

import { Icons } from '@superset-ui/core/components/Icons';
import type { IconType } from '@superset-ui/core/components/Icons/types';

interface TitleContainerProps {
  readonly isDragging: boolean;
}

const Container = styled('div', {
  shouldForwardProp: propName => propName !== 'isDragging',
})<TitleContainerProps>`
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
  filterId: string;
}

export const DraggableFilter: FC<FilterTabTitleProps> = ({
  filterId,
  children,
}) => {

  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({ id: filterId });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
  };

  return (
    <Container ref={setNodeRef} style={style} isDragging={isDragging} {...listeners} {...attributes}>
        <DragIcon
            isDragging={isDragging}
            aria-label='Move filter'
            className="dragIcon"
            viewBox="4 4 16 16"
        />
        <div css={{ flex: 1 }}>{children}</div>
    </Container>
  )
};

export default DraggableFilter;

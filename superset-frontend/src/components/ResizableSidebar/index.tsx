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
import { FC, ReactNode } from 'react';
import { Resizable } from 're-resizable';
import { styled } from '@apache-superset/core/theme';
import useStoredSidebarWidth from './useStoredSidebarWidth';

const ResizableWrapper = styled.div`
  position: absolute;
  height: 100%;

  :hover .sidebar-resizer::after {
    background-color: ${({ theme }) => theme.colorPrimary};
  }

  .sidebar-resizer {
    /* @z-index-above-sticky-header (100) + 1 = 101 */
    z-index: 101;
  }

  .sidebar-resizer::after {
    display: block;
    content: '';
    width: 1px;
    height: 100%;
    margin: 0 auto;
  }
`;

type Props = {
  id: string;
  initialWidth: number;
  enable: boolean;
  minWidth?: number;
  maxWidth?: number;
  children: (width: number) => ReactNode;
  // Notified with the new width when the user finishes a resize. A drag
  // re-renders only this component, so a parent that needs the width (e.g. to
  // offset a sticky header) must be told explicitly rather than inferring it.
  onWidthChange?: (width: number) => void;
};

const ResizableSidebar: FC<Props> = ({
  id,
  initialWidth,
  minWidth,
  maxWidth,
  enable,
  children,
  onWidthChange,
}) => {
  const [width, setWidth] = useStoredSidebarWidth(id, initialWidth);

  return (
    <>
      <ResizableWrapper>
        <Resizable
          enable={{ right: enable }}
          handleClasses={{
            right: 'sidebar-resizer',
            bottom: 'hidden',
            bottomRight: 'hidden',
            bottomLeft: 'hidden',
          }}
          size={{ width, height: '100%' }}
          minWidth={minWidth}
          maxWidth={maxWidth}
          onResizeStop={(e, direction, ref, d) => {
            const newWidth = width + d.width;
            setWidth(newWidth);
            onWidthChange?.(newWidth);
          }}
        />
      </ResizableWrapper>
      {children(width)}
    </>
  );
};

export default ResizableSidebar;

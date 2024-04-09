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
import React, { useEffect } from 'react';
import { css, styled } from '@superset-ui/core';
import { RootState } from 'src/dashboard/types';
import { useSelector } from 'react-redux';
import { useDragDropManager } from 'react-dnd';
import classNames from 'classnames';

const StyledDiv = styled.div`
  ${({ theme }) => css`
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto 1fr;
    flex: 1;
    /* Special cases */

    &.dragdroppable--dragging
      .dashboard-component-tabs-content
      > .empty-droptarget.empty-droptarget--full {
      height: 100%;
    }

    /* A row within a column has inset hover menu */
    .dragdroppable-column .dragdroppable-row .hover-menu--left {
      left: ${theme.gridUnit * -3}px;
      background: ${theme.colors.grayscale.light5};
      border: 1px solid ${theme.colors.grayscale.light2};
    }

    .dashboard-component-tabs {
      position: relative;
    }

    /* A column within a column or tabs has inset hover menu */
    .dragdroppable-column .dragdroppable-column .hover-menu--top,
    .dashboard-component-tabs .dragdroppable-column .hover-menu--top {
      top: ${theme.gridUnit * -3}px;
      background: ${theme.colors.grayscale.light5};
      border: 1px solid ${theme.colors.grayscale.light2};
    }

    /* move Tabs hover menu to top near actual Tabs */
    .dashboard-component-tabs > .hover-menu-container > .hover-menu--left {
      top: 0;
      transform: unset;
      background: transparent;
    }

    /* push Chart actions to upper right */
    .dragdroppable-column .dashboard-component-chart-holder .hover-menu--top,
    .dragdroppable .dashboard-component-header .hover-menu--top {
      right: ${theme.gridUnit * 2}px;
      top: ${theme.gridUnit * 2}px;
      background: transparent;
      border: none;
      transform: unset;
      left: unset;
    }
    div:hover > .hover-menu-container .hover-menu,
    .hover-menu-container .hover-menu:hover {
      opacity: 1;
    }

    p {
      margin: 0 0 ${theme.gridUnit * 2}px 0;
    }

    i.danger {
      color: ${theme.colors.error.base};
    }

    i.warning {
      color: ${theme.colors.alert.base};
    }
  `}
`;

type Props = {};

const DashboardWrapper: React.FC<Props> = ({ children }) => {
  const editMode = useSelector<RootState, boolean>(
    state => state.dashboardState.editMode,
  );
  const dragDropManager = useDragDropManager();
  const [isDragged, setIsDragged] = React.useState(
    dragDropManager.getMonitor().isDragging(),
  );

  useEffect(() => {
    const monitor = dragDropManager.getMonitor();
    const unsub = monitor.subscribeToStateChange(() => {
      setIsDragged(monitor.isDragging());
    });

    return () => {
      unsub();
    };
  }, [dragDropManager]);

  return (
    <StyledDiv
      className={classNames({
        'dragdroppable--dragging': editMode && isDragged,
      })}
    >
      {children}
    </StyledDiv>
  );
};

export default DashboardWrapper;

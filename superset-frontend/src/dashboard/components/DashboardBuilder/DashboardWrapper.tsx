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
import { FC, PropsWithChildren, useEffect, useState } from 'react';

import { css, styled } from '@superset-ui/core';
import { Constants } from '@superset-ui/core/components';
import { RootState } from 'src/dashboard/types';
import { useSelector } from 'react-redux';
import { useDragDropManager } from 'react-dnd';
import classNames from 'classnames';
import { debounce } from 'lodash';

const StyledDiv = styled.div`
  ${({ theme }) => css`
    background-color: ${theme.colorBgLayout};
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto 1fr;
    flex: 1;
    /* Special cases */

    &.dragdroppable--dragging {
      &
        .dashboard-component-tabs-content
        > .empty-droptarget.empty-droptarget--full {
        height: 100%;
      }
      & .empty-droptarget:before {
        display: block;
        border-color: ${theme.colorPrimary};
        background-color: ${theme.colorPrimaryBg};
      }
      & .grid-row:after {
        border-style: hidden;
      }
      & .droptarget-side:last-child {
        inset-inline-end: 0;
      }
      & .droptarget-edge:last-child {
        inset-block-end: 0;
      }
    }

    /* A row within a column has inset hover menu */
    .dragdroppable-column .dragdroppable-row .hover-menu--left {
      left: ${theme.sizeUnit * -3}px;
      background-color: ${theme.colorBgContainer};
      border: 1px solid ${theme.colorBorder};
    }

    .dashboard-component-tabs {
      position: relative;
    }

    /* A column within a column or tabs has inset hover menu */
    .dragdroppable-column .dragdroppable-column .hover-menu--top,
    .dashboard-component-tabs .dragdroppable-column .hover-menu--top {
      top: ${theme.sizeUnit * -3}px;
      background-color: ${theme.colorBgContainer};
      border: 1px solid ${theme.colorBorder};
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
      right: ${theme.sizeUnit * 3}px;
      top: ${theme.sizeUnit * 5}px;
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
      margin: 0 0 ${theme.sizeUnit * 2}px 0;
    }

    i.danger {
      color: ${theme.colorError};
    }

    i.warning {
      color: ${theme.colorWarning};
    }
  `}
`;

const DashboardWrapper: FC<PropsWithChildren<{}>> = ({ children }) => {
  const editMode = useSelector<RootState, boolean>(
    state => state.dashboardState.editMode,
  );
  const dragDropManager = useDragDropManager();
  const [isDragged, setIsDragged] = useState(
    dragDropManager.getMonitor().isDragging(),
  );

  useEffect(() => {
    const monitor = dragDropManager.getMonitor();
    const debouncedSetIsDragged = debounce(
      setIsDragged,
      Constants.FAST_DEBOUNCE,
    );
    const unsub = monitor.subscribeToStateChange(() => {
      const isDragging = monitor.isDragging();
      if (isDragging) {
        // set a debounced function to prevent HTML5 drag source
        // from interfering with the drop zone highlighting
        debouncedSetIsDragged(true);
      } else {
        debouncedSetIsDragged.cancel();
        setIsDragged(false);
      }
    });

    return () => {
      unsub();
      debouncedSetIsDragged.cancel();
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

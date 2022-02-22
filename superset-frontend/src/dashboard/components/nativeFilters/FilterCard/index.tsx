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

import React, { ReactNode } from 'react';
import { Filter } from '@superset-ui/core';
import Popover from 'src/components/Popover';
import { FilterCardContent } from './FilterCardContent';
import { Styles } from './Styles';

export interface FilterCardProps {
  children: ReactNode;
  filter: Filter;
  triggerNode?: (node: HTMLElement) => HTMLElement;
}

export const FilterCard = ({
  children,
  filter,
  triggerNode,
}: FilterCardProps) => {
  return (
    <Styles>
      <Popover
        placement="bottomLeft"
        overlayClassName="filter-card-popover"
        mouseEnterDelay={0.2}
        mouseLeaveDelay={0.2}
        content={<FilterCardContent filter={filter} />}
        visible
        getPopupContainer={node =>
          triggerNode?.(node) ??
          (node.parentNode as HTMLElement) ??
          document.body
        }
      >
        {children}
      </Popover>
    </Styles>
  );
};

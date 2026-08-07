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

/**
 * @fileoverview Placing a new block, in the one place both ways of asking
 * for it can reach.
 *
 * A block arrives on a dashboard two ways — clicked in the palette, or
 * dragged from it onto a container — and they must produce the same node. Two
 * copies of "what a freshly placed block looks like" is how a block dropped
 * into a section ends up subtly different from the same block clicked into
 * it, and the difference is invisible until someone hits it.
 */

import { isContainerType } from './DashboardProvider';
import { DEFAULT_COLUMNS } from './layoutStyle';
import { provider } from './store';

/**
 * What a palette drag carries.
 *
 * A private type rather than `text/plain` so a drop of anything else — a
 * file, a selection of text, a drag from another application — is not read
 * as a request to place a block.
 */
export const PALETTE_MIME = 'application/x-dashboard-building-block';

/**
 * Places a new block of `type` at the end of `parentId`'s children and
 * selects it, returning its id.
 *
 * A container arrives with the grid every other container defaults to, so a
 * nested canvas is usable the moment it lands rather than needing its columns
 * set before anything can go inside it. Selecting what was just placed is
 * what brings its properties forward: placing something is the moment you
 * want to configure it.
 */
export function placeBlock(parentId: string, type: string): string {
  const index = provider.getNode(parentId)?.children?.length ?? 0;
  const id = provider.addBuildingBlock(parentId, index, {
    type,
    ...(isContainerType(type)
      ? {
          layout: {
            columns: DEFAULT_COLUMNS,
            gap: 16,
            colSpan: DEFAULT_COLUMNS,
            rowSpan: 4,
          },
        }
      : {}),
  });
  provider.setSelection(id);
  return id;
}

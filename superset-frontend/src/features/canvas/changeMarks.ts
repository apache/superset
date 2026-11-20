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
 * @fileoverview What each kind of change is called, and what colour says so.
 *
 * Shared by the two places a change is named -- the tag on the widget itself
 * and the list in the draft banner -- so the same change cannot be described
 * one way in one place and another way in the other.
 *
 * Colour carries the kind of change, and every kind has its own:
 *
 * - **New** and **Edited** changed what a widget shows. They take the status
 *   colours and outline the widget as well, because "the numbers changed" is
 *   the news a reader must not miss.
 * - **Moved** and **Resized** changed only where a widget sits. They take
 *   plain hues rather than status ones -- nothing has gone right or wrong, so
 *   green and red would overstate them -- but they are still told apart at a
 *   glance, and from each other.
 * - **Removed** is the one that cannot be seen on the canvas at all, since
 *   the widget is gone from it, so the list is the only place it is said.
 */
import { t } from '@apache-superset/core/translation';
import type { DraftChange } from './types';

/** antd `Tag` colours: three status ones, two plain hues. */
type MarkColor = 'success' | 'processing' | 'error' | 'gold' | 'purple';

export const MARKS: Record<
  DraftChange['kind'],
  { label: () => string; color: MarkColor }
> = {
  new: { label: () => t('New'), color: 'success' },
  edited: { label: () => t('Edited'), color: 'processing' },
  moved: { label: () => t('Moved'), color: 'gold' },
  resized: { label: () => t('Resized'), color: 'purple' },
  removed: { label: () => t('Removed'), color: 'error' },
};

/** Content changed, so the widget itself is outlined, not only tagged. */
export const OUTLINED = new Set<DraftChange['kind']>(['new', 'edited']);

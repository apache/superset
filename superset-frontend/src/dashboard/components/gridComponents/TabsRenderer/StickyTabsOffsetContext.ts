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
import { createContext } from 'react';

/**
 * Distance, in pixels, from the top of the viewport at which a tab bar
 * rendered inside the dashboard grid should stick while the page scrolls.
 *
 * The dashboard header (title plus top-level tabs) is itself sticky, so the
 * first level of nested tabs pins just below it. Each level of nested tabs
 * then adds its own tab bar height for the tabs it contains, so deeper tab
 * bars stack beneath the ones above them instead of overlapping.
 *
 * `undefined` disables sticky tab bars, which is the case while editing
 * (drag-and-drop targets are laid out in document flow) and in the mobile
 * consumption experience, which pins tab bars through its own styling.
 */
export const StickyTabsOffsetContext = createContext<number | undefined>(
  undefined,
);

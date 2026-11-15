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
 * @fileoverview Pages API for Superset extensions.
 *
 * A standalone page is an extension's own page, which Superset shows without
 * its menu. The extension's backend serves it from one of its REST endpoints
 * with `render_page` (`superset_core.extensions.pages`), naming the page by
 * id, and its frontend registers the component that renders it under that id.
 *
 * @example
 * ```typescript
 * import { pages } from '@apache-superset/core';
 *
 * pages.registerPage('extensions.acme.reports.report', ReportPage);
 * ```
 */

import { ComponentType } from 'react';
import { Disposable } from '../common';

/** The props the host passes to a standalone page. */
export interface PageProps {
  /**
   * The params that the page's endpoint passed to `render_page`, e.g.
   * `{ reportId: '42' }`: what the page needs to find its content.
   */
  params: Record<string, string>;
}

/**
 * Registers the component that renders a standalone page.
 *
 * @param id The page's id, as its endpoint names it to `render_page`. The host
 * prefixes no frontend id, so it carries the extension's own prefix, e.g.
 * `extensions.acme.reports.report`.
 * @param component The page.
 * @returns A Disposable that unregisters the page when disposed.
 */
export declare function registerPage(
  id: string,
  component: ComponentType<PageProps>,
): Disposable;

/**
 * Returns the component registered for a standalone page, if any.
 */
export declare function getPage(
  id: string,
): ComponentType<PageProps> | undefined;

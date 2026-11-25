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
import { isValidElement, type ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';

/**
 * An icon antd can actually render.
 *
 * `MenuObjectChildProps.icon` is typed `ReactNode`, and a string satisfies
 * that -- but Superset's own menu entries carry a Font Awesome *class name*
 * from FAB (`icon="fa-puzzle-piece"` and friends in `initialization`,
 * forwarded as a plain string by FAB's `Menu.get_data`). antd does not
 * validate it: `replaceElement` returns a non-element unchanged, so the class
 * name renders as visible text -- "fa-table Sources" in the bar, "fa-css3 CSS
 * Templates" in Settings.
 *
 * So only a real element is passed through. A string icon is dropped, which
 * is what happened before any icon was forwarded at all -- nothing rendered
 * it. Shared, because the navbar and the Settings dropdown are built by two
 * different functions in two different files, and guarding only one of them
 * is how this shipped twice.
 */
export const asIcon = (icon: ReactNode): ReactNode =>
  isValidElement(icon) ? icon : undefined;

/**
 * Shared popup offset configuration for navbar menu dropdowns.
 */
export const NAVBAR_MENU_POPUP_OFFSET: [number, number] = [0, -8];

export const commonMenuData = {
  name: t('SQL'),
  tabs: [
    {
      name: 'Saved queries',
      label: t('Saved queries'),
      url: '/savedqueryview/list/',
      usesRouter: true,
    },
    {
      name: 'Query history',
      label: t('Query history'),
      url: '/sqllab/history/',
      usesRouter: true,
    },
  ],
};

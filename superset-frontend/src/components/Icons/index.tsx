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

import React from 'react';
import _ from 'lodash';
import AntdEnhancedIcons from './AntdEnhanced';
import Icon from './Icon';
import IconType from './IconType';

const IconFileNames = [
  'alert',
  'alert_solid',
  'alert_solid_small',
  'area-chart-tile',
  'bar-chart-tile',
  'big-number-chart-tile',
  'binoculars',
  'bolt',
  'bolt_small',
  'bolt_small_run',
  'calendar',
  'cancel',
  'cancel_solid',
  'cancel-x',
  'card_view',
  'cards',
  'cards_locked',
  'caret_down',
  'caret_left',
  'caret_right',
  'caret_up',
  'certified',
  'check',
  'checkbox-half',
  'checkbox-off',
  'checkbox-on',
  'circle_check',
  'circle_check_solid',
  'circle',
  'clock',
  'close',
  'code',
  'cog',
  'collapse',
  'color_palette',
  'current-rendered-tile',
  'components',
  'copy',
  'cursor_target',
  'database',
  'dataset_physical',
  'dataset_virtual_greyscale',
  'dataset_virtual',
  'download',
  'drag',
  'edit_alt',
  'edit',
  'email',
  'error',
  'error_solid',
  'error_solid_small',
  'exclamation',
  'expand',
  'eye',
  'eye_slash',
  'favorite-selected',
  'favorite_small_selected',
  'favorite-unselected',
  'field_abc',
  'field_boolean',
  'field_date',
  'field_derived',
  'field_num',
  'field_struct',
  'file',
  'filter',
  'filter_small',
  'folder',
  'full',
  'function_x',
  'gear',
  'grid',
  'image',
  'import',
  'info',
  'info-solid',
  'info_solid_small',
  'join',
  'keyboard',
  'layers',
  'lightbulb',
  'line-chart-tile',
  'link',
  'list',
  'list_view',
  'location',
  'lock_locked',
  'lock_unlocked',
  'map',
  'message',
  'minus',
  'minus_solid',
  'more_horiz',
  'more_vert',
  'move',
  'nav_charts',
  'nav_dashboard',
  'nav_data',
  'nav_explore',
  'nav_home',
  'nav_lab',
  'note',
  'offline',
  'paperclip',
  'pie-chart-tile',
  'placeholder',
  'plus',
  'plus_large',
  'plus_small',
  'plus_solid',
  'queued',
  'refresh',
  'running',
  'save',
  'sql',
  'search',
  'server',
  'share',
  'slack',
  'sort_asc',
  'sort_desc',
  'sort',
  'table',
  'table-chart-tile',
  'tag',
  'trash',
  'triangle_change',
  'triangle_down',
  'triangle_up',
  'up-level',
  'user',
  'warning',
  'warning_solid',
  'x-large',
  'x-small',
  'tags',
  'ballot',
  'category',
  'undo',
  'redo',
];

const iconOverrides: Record<string, React.FC<IconType>> = {};
IconFileNames.forEach(fileName => {
  const keyName = _.startCase(fileName).replace(/ /g, '');
  iconOverrides[keyName] = (props: IconType) => (
    <Icon fileName={fileName} {...props} />
  );
});

export type { IconType };

export default {
  ...AntdEnhancedIcons,
  ...iconOverrides,
};

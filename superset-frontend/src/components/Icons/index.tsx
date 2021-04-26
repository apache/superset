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
import AntdEnhancedIcons from './AntdEnhanced';
import { Icon } from './Icon';
import IconType from './IconType';

export default {
  ...AntdEnhancedIcons,
  Alert: (props: IconType) => <Icon path="alert" {...props} />,
  AlertSolid: (props: IconType) => <Icon path="alert_solid" {...props} />,
  AlertSolidSmall: (props: IconType) => (
    <Icon path="alert_solid_small" {...props} />
  ),
  Binoculars: (props: IconType) => <Icon path="binoculars" {...props} />,
  Bolt: (props: IconType) => <Icon path="bolt" {...props} />,
  BoltSmall: (props: IconType) => <Icon path="bolt_small" {...props} />,
  BoltSmallRun: (props: IconType) => <Icon path="bolt_small_run" {...props} />,
  Calendar: (props: IconType) => <Icon path="calendar" {...props} />,
  Cancel: (props: IconType) => <Icon path="cancel" {...props} />,
  CancelSolid: (props: IconType) => <Icon path="cancel_solid" {...props} />,
  CancelX: (props: IconType) => <Icon path="cancel-x" {...props} />,
  CardView: (props: IconType) => <Icon path="card_view" {...props} />,
  Cards: (props: IconType) => <Icon path="cards" {...props} />,
  CardsLocked: (props: IconType) => <Icon path="cards_locked" {...props} />,
  CaretDown: (props: IconType) => <Icon path="caret_down" {...props} />,
  CaretLeft: (props: IconType) => <Icon path="caret_left" {...props} />,
  CaretRight: (props: IconType) => <Icon path="caret_right" {...props} />,
  CaretUp: (props: IconType) => <Icon path="caret_up" {...props} />,
  Certified: (props: IconType) => <Icon path="certified" {...props} />,
  Check: (props: IconType) => <Icon path="check" {...props} />,
  CheckboxHalf: (props: IconType) => <Icon path="checkbox-half" {...props} />,
  CheckboxOff: (props: IconType) => <Icon path="checkbox-off" {...props} />,
  CheckboxOn: (props: IconType) => <Icon path="checkbox-on" {...props} />,
  CircleCheck: (props: IconType) => <Icon path="circle_check" {...props} />,
  CircleCheckSolid: (props: IconType) => (
    <Icon path="circle_check_solid" {...props} />
  ),
  Circle: (props: IconType) => <Icon path="circle" {...props} />,
  Clock: (props: IconType) => <Icon path="clock" {...props} />,
  Close: (props: IconType) => <Icon path="close" {...props} />,
  Code: (props: IconType) => <Icon path="code" {...props} />,
  Cog: (props: IconType) => <Icon path="cog" {...props} />,
  Collapse: (props: IconType) => <Icon path="collapse" {...props} />,
  ColorPalette: (props: IconType) => <Icon path="color_palette" {...props} />,
  Components: (props: IconType) => <Icon path="components" {...props} />,
  Copy: (props: IconType) => <Icon path="copy" {...props} />,
  CursorTarget: (props: IconType) => <Icon path="cursor_target" {...props} />,
  Database: (props: IconType) => <Icon path="database" {...props} />,
  DatasetPhysical: (props: IconType) => (
    <Icon path="dataset_physical" {...props} />
  ),
  DatasetVirtualGreyscale: (props: IconType) => (
    <Icon path="dataset_virtual_greyscale" {...props} />
  ),
  DatasetVirtual: (props: IconType) => (
    <Icon path="dataset_virtual" {...props} />
  ),
  Download: (props: IconType) => <Icon path="download" {...props} />,
  EditAlt: (props: IconType) => <Icon path="edit_alt" {...props} />,
  Edit: (props: IconType) => <Icon path="edit" {...props} />,
  Email: (props: IconType) => <Icon path="email" {...props} />,
  Error: (props: IconType) => <Icon path="error" {...props} />,
  ErrorSolid: (props: IconType) => <Icon path="error_solid" {...props} />,
  ErrorSolidSmall: (props: IconType) => (
    <Icon path="error_solid_small" {...props} />
  ),
  Exclamation: (props: IconType) => <Icon path="exclamation" {...props} />,
  Expand: (props: IconType) => <Icon path="expand" {...props} />,
  Eye: (props: IconType) => <Icon path="eye" {...props} />,
  EyeSlash: (props: IconType) => <Icon path="eye_slash" {...props} />,
  FavoriteSelected: (props: IconType) => (
    <Icon path="favorite-selected" {...props} />
  ),
  FavoriteSmallSelected: (props: IconType) => (
    <Icon path="favorite_small_selected" {...props} />
  ),
  FavoriteUnselected: (props: IconType) => (
    <Icon path="favorite-unselected" {...props} />
  ),
  FieldABCIcon: (props: IconType) => <Icon path="field_abc" {...props} />,
  FieldBoolean: (props: IconType) => <Icon path="field_boolean" {...props} />,
  FieldDate: (props: IconType) => <Icon path="field_date" {...props} />,
  FieldDerived: (props: IconType) => <Icon path="field_derived" {...props} />,
  FieldNum: (props: IconType) => <Icon path="field_num" {...props} />,
  FieldStruct: (props: IconType) => <Icon path="field_struct" {...props} />,
  File: (props: IconType) => <Icon path="file" {...props} />,
  Filter: (props: IconType) => <Icon path="filter" {...props} />,
  FilterSmall: (props: IconType) => <Icon path="filter_small" {...props} />,
  Folder: (props: IconType) => <Icon path="folder" {...props} />,
  Full: (props: IconType) => <Icon path="full" {...props} />,
  Function: (props: IconType) => <Icon path="function_x" {...props} />,
  Gear: (props: IconType) => <Icon path="gear" {...props} />,
  Grid: (props: IconType) => <Icon path="grid" {...props} />,
  Image: (props: IconType) => <Icon path="image" {...props} />,
  Import: (props: IconType) => <Icon path="import" {...props} />,
  Info: (props: IconType) => <Icon path="info" {...props} />,
  InfoSolid: (props: IconType) => <Icon path="info-solid" {...props} />,
  InfoSolidSmall: (props: IconType) => (
    <Icon path="info_solid_small" {...props} />
  ),
  Join: (props: IconType) => <Icon path="join" {...props} />,
  Keyboard: (props: IconType) => <Icon path="keyboard" {...props} />,
  Layers: (props: IconType) => <Icon path="layers" {...props} />,
  Lightbulb: (props: IconType) => <Icon path="lightbulb" {...props} />,
  Link: (props: IconType) => <Icon path="link" {...props} />,
  List: (props: IconType) => <Icon path="list" {...props} />,
  ListView: (props: IconType) => <Icon path="list_view" {...props} />,
  Location: (props: IconType) => <Icon path="location" {...props} />,
  LockLocked: (props: IconType) => <Icon path="lock_locked" {...props} />,
  LockUnlocked: (props: IconType) => <Icon path="lock_unlocked" {...props} />,
  Map: (props: IconType) => <Icon path="map" {...props} />,
  Message: (props: IconType) => <Icon path="message" {...props} />,
  Minus: (props: IconType) => <Icon path="minus" {...props} />,
  MinusSolid: (props: IconType) => <Icon path="minus_solid" {...props} />,
  MoreHoriz: (props: IconType) => <Icon path="more_horiz" {...props} />,
  Move: (props: IconType) => <Icon path="move" {...props} />,
  NavCharts: (props: IconType) => <Icon path="nav_charts" {...props} />,
  NavDashboard: (props: IconType) => <Icon path="nav_dashboard" {...props} />,
  NavData: (props: IconType) => <Icon path="nav_data" {...props} />,
  NavExplore: (props: IconType) => <Icon path="nav_explore" {...props} />,
  NavHome: (props: IconType) => <Icon path="nav_home" {...props} />,
  NavLab: (props: IconType) => <Icon path="nav_lab" {...props} />,
  Note: (props: IconType) => <Icon path="note" {...props} />,
  Offline: (props: IconType) => <Icon path="offline" {...props} />,
  Paperclip: (props: IconType) => <Icon path="paperclip" {...props} />,
  Placeholder: (props: IconType) => <Icon path="placeholder" {...props} />,
  Plus: (props: IconType) => <Icon path="plus" {...props} />,
  PlusLarge: (props: IconType) => <Icon path="plus_large" {...props} />,
  PlusSmall: (props: IconType) => <Icon path="plus_small" {...props} />,
  PlusSolid: (props: IconType) => <Icon path="plus_solid" {...props} />,
  Queued: (props: IconType) => <Icon path="queued" {...props} />,
  Refresh: (props: IconType) => <Icon path="refresh" {...props} />,
  Running: (props: IconType) => <Icon path="running" {...props} />,
  Save: (props: IconType) => <Icon path="save" {...props} />,
  SQL: (props: IconType) => <Icon path="sql" {...props} />,
  Search: (props: IconType) => <Icon path="search" {...props} />,
  Server: (props: IconType) => <Icon path="server" {...props} />,
  Share: (props: IconType) => <Icon path="share" {...props} />,
  Slack: (props: IconType) => <Icon path="slack" {...props} />,
  SortAsc: (props: IconType) => <Icon path="sort_asc" {...props} />,
  SortDesc: (props: IconType) => <Icon path="sort_desc" {...props} />,
  Sort: (props: IconType) => <Icon path="sort" {...props} />,
  Table: (props: IconType) => <Icon path="table" {...props} />,
  Tag: (props: IconType) => <Icon path="tag" {...props} />,
  Trash: (props: IconType) => <Icon path="trash" {...props} />,
  TriangleChange: (props: IconType) => (
    <Icon path="triangle_change" {...props} />
  ),
  TriangleDown: (props: IconType) => <Icon path="triangle_down" {...props} />,
  TriangleUp: (props: IconType) => <Icon path="triangle_up" {...props} />,
  UpLevel: (props: IconType) => <Icon path="up-level" {...props} />,
  User: (props: IconType) => <Icon path="user" {...props} />,
  Warning: (props: IconType) => <Icon path="warning" {...props} />,
  WarningSolid: (props: IconType) => <Icon path="warning_solid" {...props} />,
  XLarge: (props: IconType) => <Icon path="x-large" {...props} />,
  XSmall: (props: IconType) => <Icon path="x-small" {...props} />,
};

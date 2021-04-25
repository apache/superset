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
import { LazyIcon } from './Icon';
import IconType from './IconType';

export default {
  ...AntdEnhancedIcons,
  Alert: (props: IconType) => <LazyIcon path="alert" {...props} />,
  AlertSolid: (props: IconType) => <LazyIcon path="alert_solid" {...props} />,
  AlertSolidSmall: (props: IconType) => (
    <LazyIcon path="alert_solid_small" {...props} />
  ),
  Binoculars: (props: IconType) => <LazyIcon path="binoculars" {...props} />,
  Bolt: (props: IconType) => <LazyIcon path="bolt" {...props} />,
  BoltSmall: (props: IconType) => <LazyIcon path="bolt_small" {...props} />,
  BoltSmallRun: (props: IconType) => (
    <LazyIcon path="bolt_small_run" {...props} />
  ),
  Calendar: (props: IconType) => <LazyIcon path="calendar" {...props} />,
  Cancel: (props: IconType) => <LazyIcon path="cancel" {...props} />,
  CancelSolid: (props: IconType) => <LazyIcon path="cancel_solid" {...props} />,
  CancelX: (props: IconType) => <LazyIcon path="cancel-x" {...props} />,
  CardView: (props: IconType) => <LazyIcon path="card_view" {...props} />,
  Cards: (props: IconType) => <LazyIcon path="cards" {...props} />,
  CardsLocked: (props: IconType) => <LazyIcon path="cards_locked" {...props} />,
  CaretDown: (props: IconType) => <LazyIcon path="caret_down" {...props} />,
  CaretLeft: (props: IconType) => <LazyIcon path="caret_left" {...props} />,
  CaretRight: (props: IconType) => <LazyIcon path="caret_right" {...props} />,
  CaretUp: (props: IconType) => <LazyIcon path="caret_up" {...props} />,
  Certified: (props: IconType) => <LazyIcon path="certified" {...props} />,
  Check: (props: IconType) => <LazyIcon path="check" {...props} />,
  CheckboxHalf: (props: IconType) => (
    <LazyIcon path="checkbox-half" {...props} />
  ),
  CheckboxOff: (props: IconType) => <LazyIcon path="checkbox-off" {...props} />,
  CheckboxOn: (props: IconType) => <LazyIcon path="checkbox-on" {...props} />,
  CircleCheck: (props: IconType) => <LazyIcon path="circle_check" {...props} />,
  CircleCheckSolid: (props: IconType) => (
    <LazyIcon path="circle_check_solid" {...props} />
  ),
  Circle: (props: IconType) => <LazyIcon path="circle" {...props} />,
  Clock: (props: IconType) => <LazyIcon path="clock" {...props} />,
  Close: (props: IconType) => <LazyIcon path="close" {...props} />,
  Code: (props: IconType) => <LazyIcon path="code" {...props} />,
  Cog: (props: IconType) => <LazyIcon path="cog" {...props} />,
  Collapse: (props: IconType) => <LazyIcon path="collapse" {...props} />,
  ColorPalette: (props: IconType) => (
    <LazyIcon path="color_palette" {...props} />
  ),
  Components: (props: IconType) => <LazyIcon path="components" {...props} />,
  Copy: (props: IconType) => <LazyIcon path="copy" {...props} />,
  CursorTarget: (props: IconType) => (
    <LazyIcon path="cursor_target" {...props} />
  ),
  Database: (props: IconType) => <LazyIcon path="database" {...props} />,
  DatasetPhysical: (props: IconType) => (
    <LazyIcon path="dataset_physical" {...props} />
  ),
  DatasetVirtualGreyscale: (props: IconType) => (
    <LazyIcon path="dataset_virtual_greyscale" {...props} />
  ),
  DatasetVirtual: (props: IconType) => (
    <LazyIcon path="dataset_virtual" {...props} />
  ),
  Download: (props: IconType) => <LazyIcon path="download" {...props} />,
  EditAlt: (props: IconType) => <LazyIcon path="edit_alt" {...props} />,
  Edit: (props: IconType) => <LazyIcon path="edit" {...props} />,
  Email: (props: IconType) => <LazyIcon path="email" {...props} />,
  Error: (props: IconType) => <LazyIcon path="error" {...props} />,
  ErrorSolid: (props: IconType) => <LazyIcon path="error_solid" {...props} />,
  ErrorSolidSmall: (props: IconType) => (
    <LazyIcon path="error_solid_small" {...props} />
  ),
  Exclamation: (props: IconType) => <LazyIcon path="exclamation" {...props} />,
  Expand: (props: IconType) => <LazyIcon path="expand" {...props} />,
  Eye: (props: IconType) => <LazyIcon path="eye" {...props} />,
  EyeSlash: (props: IconType) => <LazyIcon path="eye_slash" {...props} />,
  FavoriteSelected: (props: IconType) => (
    <LazyIcon path="favorite-selected" {...props} />
  ),
  FavoriteSmallSelected: (props: IconType) => (
    <LazyIcon path="favorite_small_selected" {...props} />
  ),
  FavoriteUnselected: (props: IconType) => (
    <LazyIcon path="favorite-unselected" {...props} />
  ),
  FieldABCIcon: (props: IconType) => <LazyIcon path="field_abc" {...props} />,
  FieldBoolean: (props: IconType) => (
    <LazyIcon path="field_boolean" {...props} />
  ),
  FieldDate: (props: IconType) => <LazyIcon path="field_date" {...props} />,
  FieldDerived: (props: IconType) => (
    <LazyIcon path="field_derived" {...props} />
  ),
  FieldNum: (props: IconType) => <LazyIcon path="field_num" {...props} />,
  FieldStruct: (props: IconType) => <LazyIcon path="field_struct" {...props} />,
  File: (props: IconType) => <LazyIcon path="file" {...props} />,
  Filter: (props: IconType) => <LazyIcon path="filter" {...props} />,
  FilterSmall: (props: IconType) => <LazyIcon path="filter_small" {...props} />,
  Folder: (props: IconType) => <LazyIcon path="folder" {...props} />,
  Full: (props: IconType) => <LazyIcon path="full" {...props} />,
  Function: (props: IconType) => <LazyIcon path="function_x" {...props} />,
  Gear: (props: IconType) => <LazyIcon path="gear" {...props} />,
  Grid: (props: IconType) => <LazyIcon path="grid" {...props} />,
  Image: (props: IconType) => <LazyIcon path="image" {...props} />,
  Import: (props: IconType) => <LazyIcon path="import" {...props} />,
  Info: (props: IconType) => <LazyIcon path="info" {...props} />,
  InfoSolid: (props: IconType) => <LazyIcon path="info-solid" {...props} />,
  InfoSolidSmall: (props: IconType) => (
    <LazyIcon path="info_solid_small" {...props} />
  ),
  Join: (props: IconType) => <LazyIcon path="join" {...props} />,
  Keyboard: (props: IconType) => <LazyIcon path="keyboard" {...props} />,
  Layers: (props: IconType) => <LazyIcon path="layers" {...props} />,
  Lightbulb: (props: IconType) => <LazyIcon path="lightbulb" {...props} />,
  Link: (props: IconType) => <LazyIcon path="link" {...props} />,
  List: (props: IconType) => <LazyIcon path="list" {...props} />,
  ListView: (props: IconType) => <LazyIcon path="list_view" {...props} />,
  Location: (props: IconType) => <LazyIcon path="location" {...props} />,
  LockLocked: (props: IconType) => <LazyIcon path="lock_locked" {...props} />,
  LockUnlocked: (props: IconType) => (
    <LazyIcon path="lock_unlocked" {...props} />
  ),
  Map: (props: IconType) => <LazyIcon path="map" {...props} />,
  Message: (props: IconType) => <LazyIcon path="message" {...props} />,
  Minus: (props: IconType) => <LazyIcon path="minus" {...props} />,
  MinusSolid: (props: IconType) => <LazyIcon path="minus_solid" {...props} />,
  MoreHoriz: (props: IconType) => <LazyIcon path="more_horiz" {...props} />,
  Move: (props: IconType) => <LazyIcon path="move" {...props} />,
  NavCharts: (props: IconType) => <LazyIcon path="nav_charts" {...props} />,
  NavDashboard: (props: IconType) => (
    <LazyIcon path="nav_dashboard" {...props} />
  ),
  NavData: (props: IconType) => <LazyIcon path="nav_data" {...props} />,
  NavExplore: (props: IconType) => <LazyIcon path="nav_explore" {...props} />,
  NavHome: (props: IconType) => <LazyIcon path="nav_home" {...props} />,
  NavLab: (props: IconType) => <LazyIcon path="nav_lab" {...props} />,
  Note: (props: IconType) => <LazyIcon path="note" {...props} />,
  Offline: (props: IconType) => <LazyIcon path="offline" {...props} />,
  Paperclip: (props: IconType) => <LazyIcon path="paperclip" {...props} />,
  Placeholder: (props: IconType) => <LazyIcon path="placeholder" {...props} />,
  Plus: (props: IconType) => <LazyIcon path="plus" {...props} />,
  PlusLarge: (props: IconType) => <LazyIcon path="plus_large" {...props} />,
  PlusSmall: (props: IconType) => <LazyIcon path="plus_small" {...props} />,
  PlusSolid: (props: IconType) => <LazyIcon path="plus_solid" {...props} />,
  Queued: (props: IconType) => <LazyIcon path="queued" {...props} />,
  Refresh: (props: IconType) => <LazyIcon path="refresh" {...props} />,
  Running: (props: IconType) => <LazyIcon path="running" {...props} />,
  Save: (props: IconType) => <LazyIcon path="save" {...props} />,
  SQL: (props: IconType) => <LazyIcon path="sql" {...props} />,
  Search: (props: IconType) => <LazyIcon path="search" {...props} />,
  Server: (props: IconType) => <LazyIcon path="server" {...props} />,
  Share: (props: IconType) => <LazyIcon path="share" {...props} />,
  Slack: (props: IconType) => <LazyIcon path="slack" {...props} />,
  SortAsc: (props: IconType) => <LazyIcon path="sort_asc" {...props} />,
  SortDesc: (props: IconType) => <LazyIcon path="sort_desc" {...props} />,
  Sort: (props: IconType) => <LazyIcon path="sort" {...props} />,
  Table: (props: IconType) => <LazyIcon path="table" {...props} />,
  Tag: (props: IconType) => <LazyIcon path="tag" {...props} />,
  Trash: (props: IconType) => <LazyIcon path="trash" {...props} />,
  TriangleChange: (props: IconType) => (
    <LazyIcon path="triangle_change" {...props} />
  ),
  TriangleDown: (props: IconType) => (
    <LazyIcon path="triangle_down" {...props} />
  ),
  TriangleUp: (props: IconType) => <LazyIcon path="triangle_up" {...props} />,
  UpLevel: (props: IconType) => <LazyIcon path="up-level" {...props} />,
  User: (props: IconType) => <LazyIcon path="user" {...props} />,
  Warning: (props: IconType) => <LazyIcon path="warning" {...props} />,
  WarningSolid: (props: IconType) => (
    <LazyIcon path="warning_solid" {...props} />
  ),
  XLarge: (props: IconType) => <LazyIcon path="x-large" {...props} />,
  XSmall: (props: IconType) => <LazyIcon path="x-small" {...props} />,
};

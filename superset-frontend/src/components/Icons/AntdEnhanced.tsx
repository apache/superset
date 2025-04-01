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

// NOTE: Targeted import (as opposed to `import *`) is important here for proper tree-shaking
// eslint-disable-next-line no-restricted-imports
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  AreaChartOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  BgColorsOutlined,
  BellOutlined,
  BookOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
  CaretLeftOutlined,
  CaretRightOutlined,
  CalendarOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  CheckSquareOutlined,
  CloseOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ColumnWidthOutlined,
  CommentOutlined,
  ConsoleSqlOutlined,
  CopyOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeleteFilled,
  DownSquareOutlined,
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  EditOutlined,
  EllipsisOutlined,
  ExclamationCircleOutlined,
  ExclamationCircleFilled,
  EyeOutlined,
  EyeInvisibleOutlined,
  FallOutlined,
  FieldTimeOutlined,
  FileImageOutlined,
  FileOutlined,
  FileTextOutlined,
  FireOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  FundProjectionScreenOutlined,
  FunctionOutlined,
  InfoCircleOutlined,
  InfoCircleFilled,
  InsertRowAboveOutlined,
  InsertRowBelowOutlined,
  LineChartOutlined,
  LinkOutlined,
  MailOutlined,
  MinusCircleOutlined,
  LoadingOutlined,
  MonitorOutlined,
  MoreOutlined,
  PieChartOutlined,
  PicCenterOutlined,
  PlusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  StarOutlined,
  StarFilled,
  StopOutlined,
  SyncOutlined,
  TagOutlined,
  TagsOutlined,
  TableOutlined,
  LockOutlined,
  UnlockOutlined,
  UploadOutlined,
  UpOutlined,
  UserOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined,
  VerticalLeftOutlined,
  VerticalRightOutlined,
  NumberOutlined,
  ThunderboltOutlined,
  FilterOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { FC } from 'react';
import { IconType } from './types';
import { BaseIconComponent } from './BaseIcon';

// partial name matches work too
const EXCLUDED_ICONS = ['TwoTone'];

const AntdIcons = {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  AreaChartOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  BgColorsOutlined,
  BellOutlined,
  BookOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
  CaretLeftOutlined,
  CaretRightOutlined,
  CalendarOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  CheckSquareOutlined,
  CloseOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ColumnWidthOutlined,
  CommentOutlined,
  ConsoleSqlOutlined,
  CopyOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeleteFilled,
  DownSquareOutlined,
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  EditOutlined,
  EllipsisOutlined,
  ExclamationCircleOutlined,
  ExclamationCircleFilled,
  EyeOutlined,
  EyeInvisibleOutlined,
  FallOutlined,
  FieldTimeOutlined,
  FileImageOutlined,
  FileOutlined,
  FileTextOutlined,
  FireOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  FundProjectionScreenOutlined,
  FunctionOutlined,
  InfoCircleOutlined,
  InfoCircleFilled,
  InsertRowAboveOutlined,
  InsertRowBelowOutlined,
  LineChartOutlined,
  LinkOutlined,
  LoadingOutlined,
  MailOutlined,
  MinusCircleOutlined,
  MonitorOutlined,
  MoreOutlined,
  PieChartOutlined,
  PicCenterOutlined,
  PlusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  StarOutlined,
  StarFilled,
  StopOutlined,
  SyncOutlined,
  TagOutlined,
  TagsOutlined,
  TableOutlined,
  LockOutlined,
  UploadOutlined,
  UnlockOutlined,
  UpOutlined,
  UserOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined,
  VerticalLeftOutlined,
  VerticalRightOutlined,
  NumberOutlined,
  ThunderboltOutlined,
  FilterOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} as const;

type AntdIconNames = keyof typeof AntdIcons;

export const antdEnhancedIcons: Record<
  AntdIconNames,
  FC<IconType>
> = Object.keys(AntdIcons)
  .filter(key => !EXCLUDED_ICONS.some(excluded => key.includes(excluded)))
  .reduce(
    (acc, key) => {
      acc[key as AntdIconNames] = (props: IconType) => (
        <BaseIconComponent
          component={AntdIcons[key as AntdIconNames]}
          fileName={key}
          {...props}
        />
      );
      return acc;
    },
    {} as Record<AntdIconNames, FC<IconType>>,
  );

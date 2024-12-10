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
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  ApartmentOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckOutlined,
  CheckSquareOutlined,
  CloseOutlined,
  CommentOutlined,
  ConsoleSqlOutlined,
  CopyOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeleteFilled,
  DownOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  FallOutlined,
  FileImageOutlined,
  FileOutlined,
  FireOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  FundProjectionScreenOutlined,
  InfoCircleOutlined,
  InsertRowBelowOutlined,
  LineChartOutlined,
  LoadingOutlined,
  MonitorOutlined,
  PicCenterOutlined,
  PlusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  StopOutlined,
  SyncOutlined,
  TagsOutlined,
  UpOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { StyledIcon } from './Icon';
import IconType from './IconType';

const AntdIcons = {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  ApartmentOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckOutlined,
  CheckSquareOutlined,
  CloseOutlined,
  CommentOutlined,
  ConsoleSqlOutlined,
  CopyOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeleteFilled,
  DownOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  FallOutlined,
  FileImageOutlined,
  FileOutlined,
  FireOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  FundProjectionScreenOutlined,
  InfoCircleOutlined,
  InsertRowBelowOutlined,
  LineChartOutlined,
  LoadingOutlined,
  MonitorOutlined,
  PicCenterOutlined,
  PlusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  StopOutlined,
  SyncOutlined,
  TagsOutlined,
  UpOutlined,
  UserOutlined,
};

const AntdEnhancedIcons = Object.keys(AntdIcons)
  .filter(k => !k.includes('TwoTone'))
  .map(k => ({
    [k]: (props: IconType) => {
      const whatRole = props?.onClick ? 'button' : 'img';
      return <StyledIcon component={AntdIcons[k]} role={whatRole} {...props} />;
    },
  }))
  .reduce((l, r) => ({ ...l, ...r }));

export default AntdEnhancedIcons;

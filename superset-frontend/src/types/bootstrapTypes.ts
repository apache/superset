import {
  ColorSchemeConfig,
  FeatureFlagMap,
  JsonObject,
  LanguagePack,
  Locale,
  SequentialSchemeConfig,
} from '@superset-ui/core';
import { isPlainObject } from 'lodash';
import { Languages } from 'src/features/home/LanguagePicker';
import { FlashMessage } from '../components/FlashProvider';

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
export type User = {
  createdOn?: string;
  email?: string;
  firstName: string;
  isActive: boolean;
  isAnonymous: boolean;
  lastName: string;
  userId?: number; // optional because guest user doesn't have a user id
  username: string;
};

export type UserRoles = Record<string, [string, string][]>;
export interface PermissionsAndRoles {
  permissions: {
    database_access?: string[];
    datasource_access?: string[];
  };
  roles: UserRoles;
}

export type UserWithPermissionsAndRoles = User & PermissionsAndRoles;

export type UndefinedUser = {};

export type BootstrapUser = UserWithPermissionsAndRoles | undefined;

export type Dashboard = {
  dttm: number;
  id: number;
  url: string;
  title: string;
  creator?: string;
  creator_url?: string;
};

export type DashboardData = {
  dashboard_title?: string;
  created_on_delta_humanized?: string;
  url: string;
};

export type DashboardResponse = {
  result: DashboardData[];
};

export type ChartData = {
  slice_name: string;
  created_on_delta_humanized?: string;
  url: string;
};

export type ChartResponse = {
  result: ChartData[];
};

export interface BrandProps {
  path: string;
  icon: string;
  alt: string;
  tooltip: string;
  text: string;
}

export interface NavBarProps {
  show_watermark: boolean;
  bug_report_url?: string;
  bug_report_text?: string;
  bug_report_icon?: string;
  version_string?: string;
  version_sha?: string;
  build_number?: string;
  documentation_url?: string;
  documentation_text?: string;
  documentation_icon?: string;
  languages: Languages;
  show_language_picker: boolean;
  user_is_anonymous: boolean;
  user_info_url: string;
  user_login_url: string;
  user_logout_url: string;
  user_profile_url: string | null;
  locale: string;
}

export interface MenuObjectChildProps {
  label: string;
  name?: string;
  icon?: string;
  index?: number;
  url?: string;
  isFrontendRoute?: boolean;
  perm?: string | boolean;
  view?: string;
  disable?: boolean;
}

export interface MenuObjectProps extends MenuObjectChildProps {
  childs?: (MenuObjectChildProps | string)[];
  isHeader?: boolean;
}

export interface MenuData {
  menu: MenuObjectProps[];
  brand: BrandProps;
  navbar_right: NavBarProps;
  settings: MenuObjectProps[];
  environment_tag: {
    text: string;
    color: string;
  };
}

export interface CommonBootstrapData {
  flash_messages: FlashMessage[];
  conf: JsonObject;
  locale: Locale;
  feature_flags: FeatureFlagMap;
  language_pack: LanguagePack;
  extra_categorical_color_schemes: ColorSchemeConfig[];
  extra_sequential_color_schemes: SequentialSchemeConfig[];
  theme_overrides: JsonObject;
  menu_data: MenuData;
}

export interface BootstrapData {
  user?: BootstrapUser;
  common: CommonBootstrapData;
  config?: any;
  embedded?: {
    dashboard_id: string;
  };
}

export function isUser(user: any): user is User {
  return isPlainObject(user) && 'username' in user;
}

export function isUserWithPermissionsAndRoles(
  user: any,
): user is UserWithPermissionsAndRoles {
  return isUser(user) && 'permissions' in user && 'roles' in user;
}

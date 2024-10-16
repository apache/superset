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

/*
 * Re-exporting of components in src/components to facilitate
 * their imports by other components.
 * E.g. import { Select } from 'src/components'
 */
export { default as Select } from './Select/Select';
export { default as AsyncSelect } from './Select/AsyncSelect';
export { default as Button } from './Button';

/*
 * Components that don't conflict with the ones in src/components.
 * As Superset progresses to support full theming, this list should
 * decrease in favor of the components defined in src/components.
 */
export {
  AutoComplete,
  Avatar,
  Col,
  Divider,
  Empty,
  Grid,
  List,
  Row,
  Skeleton,
  Space,
  Steps,
  Tag,
  Tree,
  TreeSelect,
  Typography,
  Upload,
} from 'antd';

/*
 * Components that conflict with the ones in src/components.
 * We should try to avoid using Ant Design directly. The components
 * listed below may need review. Avoid incrementing this list by using
 * or extending the components in src/components.
 */
export {
  Breadcrumb as AntdBreadcrumb,
  Card as AntdCard,
  Checkbox as AntdCheckbox,
  Collapse as AntdCollapse,
  Dropdown as AntdDropdown,
  Form as AntdForm,
  Input as AntdInput,
  Modal as AntdModal,
  Select as AntdSelect,
  Slider as AntdSlider,
  Switch as AntdSwitch,
  Tabs as AntdTabs,
  Tooltip as AntdTooltip,
} from 'antd';

// Exported types
export type { FormInstance } from 'antd/lib/form';
export type { ListItemProps } from 'antd/lib/list';
export type { ModalProps as AntdModalProps } from 'antd/lib/modal';
export type { DropDownProps as AntdDropdownProps } from 'antd/lib/dropdown';
export type { RadioChangeEvent } from 'antd/lib/radio';

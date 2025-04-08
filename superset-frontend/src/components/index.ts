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
 * Components that conflict with the ones in src/components.
 * We should try to avoid using Ant Design directly. The components
 * listed below may need review. Avoid incrementing this list by using
 * or extending the components in src/components.
 */
// TODO: Remove these imports
// eslint-disable-next-line no-restricted-imports
export { Breadcrumb as AntdBreadcrumb, Checkbox as AntdCheckbox } from 'antd';

/*
 * Re-exporting of components in src/components to facilitate
 * their imports by other components.
 * E.g. import { Select } from 'src/components', probably in the future from '@superset-ui/components'
 */
export { Select, AsyncSelect } from './Select';

// eslint-disable-next-line no-restricted-imports
export type { RadioChangeEvent } from 'antd/lib/radio'; // TODO: Remove antd

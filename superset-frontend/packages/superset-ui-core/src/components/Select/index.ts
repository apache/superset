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
import Select from './Select';
import AsyncSelect from './AsyncSelect';

export { Select, AsyncSelect };
export * from './types';
export * from './styles';
export * from './constants';

// TODO hack to provide vanilla antd Select and SelectProps as
// we mutated the interface quite a bit here, and some internal packages
// are still using the vanilla antd Select
export { Select as RawAntdSelect } from 'antd';
export { type SelectProps as RawAntdSelectProps } from 'antd/es/select';

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
import { ReactNode } from 'react';
import { SelectProps as AntdSelectProps } from 'antd/lib/select';
export declare const Option: any;
export declare type SelectOption<VT = string> = [VT, ReactNode];
export declare type SelectProps<VT> = Omit<AntdSelectProps<VT>, 'options'> & {
    creatable?: boolean;
    minWidth?: string | number;
    options?: SelectOption<VT>[];
};
/**
 * AntD select with creatable options.
 */
declare function Select<VT extends string | number>({ creatable, onSearch, dropdownMatchSelectWidth, minWidth, showSearch: showSearch_, onChange, options, children, value, ...props }: SelectProps<VT>): JSX.Element;
declare namespace Select {
    var Option: any;
}
export default Select;
//# sourceMappingURL=Select.d.ts.map
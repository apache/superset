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
export declare type SizeOption = [number, string];
export interface SelectPageSizeRendererProps {
    current: number;
    options: SizeOption[];
    onChange: SelectPageSizeProps['onChange'];
}
declare function DefaultSelectRenderer({ current, options, onChange, }: SelectPageSizeRendererProps): JSX.Element;
export interface SelectPageSizeProps extends SelectPageSizeRendererProps {
    total?: number;
    selectRenderer?: typeof DefaultSelectRenderer;
    onChange: (pageSize: number) => void;
}
declare const _default: React.NamedExoticComponent<SelectPageSizeProps>;
export default _default;
//# sourceMappingURL=SelectPageSize.d.ts.map
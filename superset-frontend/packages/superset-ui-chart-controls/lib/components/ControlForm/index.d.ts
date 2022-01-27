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
import { FunctionComponentElement } from 'react';
import { JsonObject } from '@superset-ui/core';
import { ControlFormItemNode } from './ControlFormItem';
export * from './ControlFormItem';
export declare type ControlFormRowProps = {
    children: ControlFormItemNode | ControlFormItemNode[];
};
export declare function ControlFormRow({ children }: ControlFormRowProps): JSX.Element;
declare type ControlFormRowNode = FunctionComponentElement<ControlFormRowProps>;
export declare type ControlFormProps = {
    /**
     * Form field values dict.
     */
    value?: JsonObject;
    onChange: (value: JsonObject) => void;
    children: ControlFormRowNode | ControlFormRowNode[];
};
/**
 * Light weight form for control panel.
 */
export default function ControlForm({ onChange, value, children, }: ControlFormProps): JSX.Element;
//# sourceMappingURL=index.d.ts.map
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
import React, { ReactNode } from 'react';
import { Input } from 'antd';
import { CheckboxProps } from 'antd/lib/checkbox';
import Select, { SelectOption } from '../Select';
import RadioButtonControl, { RadioButtonOption } from '../../shared-controls/components/RadioButtonControl';
export declare const ControlFormItemComponents: {
    Slider: React.ForwardRefExoticComponent<(import("antd/lib/slider").SliderSingleProps & React.RefAttributes<unknown>) | (import("antd/lib/slider").SliderRangeProps & React.RefAttributes<unknown>)>;
    InputNumber: React.ForwardRefExoticComponent<import("antd/lib/input-number").InputNumberProps & React.RefAttributes<unknown>>;
    Input: typeof Input;
    Select: typeof Select;
    Checkbox: React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<HTMLInputElement>>;
    RadioButtonControl: typeof RadioButtonControl;
};
export declare type ControlType = keyof typeof ControlFormItemComponents;
export declare type ControlFormValueValidator<V> = (value: V) => string | false;
export declare type ControlFormItemSpec<T extends ControlType = ControlType> = {
    controlType: T;
    label: ReactNode;
    description: ReactNode;
    placeholder?: string;
    required?: boolean;
    validators?: ControlFormValueValidator<any>[];
    width?: number | string;
    /**
     * Time to delay change propagation.
     */
    debounceDelay?: number;
} & (T extends 'Select' ? {
    options: SelectOption<any>[];
    value?: string;
    defaultValue?: string;
    creatable?: boolean;
    minWidth?: number | string;
    validators?: ControlFormValueValidator<string>[];
} : T extends 'RadioButtonControl' ? {
    options: RadioButtonOption[];
    value?: string;
    defaultValue?: string;
} : T extends 'Checkbox' ? {
    value?: boolean;
    defaultValue?: boolean;
} : T extends 'InputNumber' | 'Slider' ? {
    min?: number;
    max?: number;
    step?: number;
    value?: number;
    defaultValue?: number;
    validators?: ControlFormValueValidator<number>[];
} : T extends 'Input' ? {
    controlType: 'Input';
    value?: string;
    defaultValue?: string;
    validators?: ControlFormValueValidator<string>[];
} : {});
//# sourceMappingURL=controls.d.ts.map
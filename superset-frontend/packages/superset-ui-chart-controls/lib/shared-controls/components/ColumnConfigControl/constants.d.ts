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
import { ControlFormItemSpec } from '../../../components/ControlForm';
import { ColumnConfigFormLayout } from './types';
export declare type SharedColumnConfigProp = 'alignPositiveNegative' | 'colorPositiveNegative' | 'columnWidth' | 'fractionDigits' | 'emitTarget' | 'd3NumberFormat' | 'd3SmallNumberFormat' | 'd3TimeFormat' | 'horizontalAlign' | 'showCellBars';
/**
 * All configurable column formatting properties.
 */
export declare const SHARED_COLUMN_CONFIG_PROPS: {
    d3NumberFormat: ControlFormItemSpec<"Select">;
    emitTarget: ControlFormItemSpec<"Input">;
    d3SmallNumberFormat: {
        label: string;
        description: string;
        controlType: "Select";
        placeholder?: string | undefined;
        required?: boolean | undefined;
        validators?: (import("../../../components/ControlForm").ControlFormValueValidator<any>[] & import("../../../components/ControlForm").ControlFormValueValidator<string>[]) | undefined;
        width?: string | number | undefined;
        debounceDelay?: number | undefined;
        options: import("../../../components/Select").SelectOption<any>[];
        value?: string | undefined;
        defaultValue?: string | undefined;
        creatable?: boolean | undefined;
        minWidth?: string | number | undefined;
    };
    d3TimeFormat: ControlFormItemSpec<"Select">;
    fractionDigits: ControlFormItemSpec<"Slider">;
    columnWidth: ControlFormItemSpec<"InputNumber">;
    horizontalAlign: {
        controlType: "RadioButtonControl";
        label: React.ReactNode;
        description: React.ReactNode;
        placeholder?: string | undefined;
        required?: boolean | undefined;
        validators?: import("../../../components/ControlForm").ControlFormValueValidator<any>[] | undefined;
        width?: string | number | undefined;
        debounceDelay?: number | undefined;
    } & {
        options: import("..").RadioButtonOption[];
        value?: string | undefined;
        defaultValue?: string | undefined;
    } & {
        value?: "center" | "left" | "right" | undefined;
        defaultValue?: "center" | "left" | "right" | undefined;
    };
    showCellBars: ControlFormItemSpec<"Checkbox">;
    alignPositiveNegative: ControlFormItemSpec<"Checkbox">;
    colorPositiveNegative: ControlFormItemSpec<"Checkbox">;
};
export declare type SharedColumnConfig = {
    [key in SharedColumnConfigProp]?: typeof SHARED_COLUMN_CONFIG_PROPS[key]['value'];
};
export declare const DEFAULT_CONFIG_FORM_LAYOUT: ColumnConfigFormLayout;
//# sourceMappingURL=constants.d.ts.map
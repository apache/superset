export namespace filterNulls {
    const name: string;
    namespace config {
        export const type: string;
        export const label: string;
        const _default: boolean;
        export { _default as default };
        export const description: string;
    }
}
export namespace autozoom {
    const name_1: string;
    export { name_1 as name };
    export namespace config_1 {
        const type_1: string;
        export { type_1 as type };
        const label_1: string;
        export { label_1 as label };
        const _default_1: boolean;
        export { _default_1 as default };
        export const renderTrigger: boolean;
        const description_1: string;
        export { description_1 as description };
    }
    export { config_1 as config };
}
export namespace dimension {
    const name_2: string;
    export { name_2 as name };
    const config_2: {
        label: string;
        description: string;
        multi: boolean;
        default: null;
        type: "DndColumnSelect";
        renderTrigger?: boolean | undefined;
        validators?: import("@superset-ui/chart-controls").ControlValueValidator<"DndColumnSelect", import("@superset-ui/chart-controls").SelectOption, import("@superset-ui/core").JsonValue>[] | undefined;
        warning?: React.ReactNode;
        error?: React.ReactNode;
        mapStateToProps?: ((state: import("@superset-ui/chart-controls").ControlPanelState, controlState: import("@superset-ui/chart-controls").ControlState<import("@superset-ui/chart-controls").ControlType, import("@superset-ui/chart-controls").SelectOption>, chartState?: {
            [x: string]: any;
        } | undefined) => import("@superset-ui/chart-controls").ExtraControlProps) | undefined;
        visibility?: ((props: import("@superset-ui/chart-controls").ControlPanelsContainerProps) => boolean) | undefined;
    } | {
        label: string;
        description: string;
        multi: boolean;
        default: null;
        clearable?: boolean | undefined;
        freeForm?: boolean | undefined;
        valueKey?: string | undefined;
        labelKey?: string | undefined;
        options?: import("@superset-ui/chart-controls").ColumnMeta[] | undefined;
        optionRenderer?: ((option: import("@superset-ui/chart-controls").ColumnMeta) => React.ReactNode) | undefined;
        valueRenderer?: ((option: import("@superset-ui/chart-controls").ColumnMeta) => React.ReactNode) | undefined;
        filterOption?: ((option: import("@superset-ui/chart-controls").FilterOption<import("@superset-ui/chart-controls").ColumnMeta>, rawInput: string) => Boolean) | null | undefined;
        type: "SelectControl";
        renderTrigger?: boolean | undefined;
        validators?: import("@superset-ui/chart-controls").ControlValueValidator<"SelectControl", import("@superset-ui/chart-controls").ColumnMeta, import("@superset-ui/core").JsonValue>[] | undefined;
        warning?: React.ReactNode;
        error?: React.ReactNode;
        mapStateToProps?: ((state: import("@superset-ui/chart-controls").ControlPanelState, controlState: import("@superset-ui/chart-controls").ControlState<import("@superset-ui/chart-controls").ControlType, import("@superset-ui/chart-controls").SelectOption>, chartState?: {
            [x: string]: any;
        } | undefined) => import("@superset-ui/chart-controls").ExtraControlProps) | undefined;
        visibility?: ((props: import("@superset-ui/chart-controls").ControlPanelsContainerProps) => boolean) | undefined;
    };
    export { config_2 as config };
}
export namespace jsColumns {
    const name_3: string;
    export { name_3 as name };
    const config_3: {
        label: string;
        default: never[];
        description: string;
        type: "DndColumnSelect";
        renderTrigger?: boolean | undefined;
        validators?: import("@superset-ui/chart-controls").ControlValueValidator<"DndColumnSelect", import("@superset-ui/chart-controls").SelectOption, import("@superset-ui/core").JsonValue>[] | undefined;
        warning?: React.ReactNode;
        error?: React.ReactNode;
        mapStateToProps?: ((state: import("@superset-ui/chart-controls").ControlPanelState, controlState: import("@superset-ui/chart-controls").ControlState<import("@superset-ui/chart-controls").ControlType, import("@superset-ui/chart-controls").SelectOption>, chartState?: {
            [x: string]: any;
        } | undefined) => import("@superset-ui/chart-controls").ExtraControlProps) | undefined;
        visibility?: ((props: import("@superset-ui/chart-controls").ControlPanelsContainerProps) => boolean) | undefined;
    } | {
        label: string;
        default: never[];
        description: string;
        clearable?: boolean | undefined;
        freeForm?: boolean | undefined;
        multi?: boolean | undefined;
        valueKey?: string | undefined;
        labelKey?: string | undefined;
        options?: import("@superset-ui/chart-controls").ColumnMeta[] | undefined;
        optionRenderer?: ((option: import("@superset-ui/chart-controls").ColumnMeta) => React.ReactNode) | undefined;
        valueRenderer?: ((option: import("@superset-ui/chart-controls").ColumnMeta) => React.ReactNode) | undefined;
        filterOption?: ((option: import("@superset-ui/chart-controls").FilterOption<import("@superset-ui/chart-controls").ColumnMeta>, rawInput: string) => Boolean) | null | undefined;
        type: "SelectControl";
        renderTrigger?: boolean | undefined;
        validators?: import("@superset-ui/chart-controls").ControlValueValidator<"SelectControl", import("@superset-ui/chart-controls").ColumnMeta, import("@superset-ui/core").JsonValue>[] | undefined;
        warning?: React.ReactNode;
        error?: React.ReactNode;
        mapStateToProps?: ((state: import("@superset-ui/chart-controls").ControlPanelState, controlState: import("@superset-ui/chart-controls").ControlState<import("@superset-ui/chart-controls").ControlType, import("@superset-ui/chart-controls").SelectOption>, chartState?: {
            [x: string]: any;
        } | undefined) => import("@superset-ui/chart-controls").ExtraControlProps) | undefined;
        visibility?: ((props: import("@superset-ui/chart-controls").ControlPanelsContainerProps) => boolean) | undefined;
    };
    export { config_3 as config };
}
export namespace jsDataMutator {
    const name_4: string;
    export { name_4 as name };
    export namespace config_4 {
        const type_2: string;
        export { type_2 as type };
        export const language: string;
        export { label };
        export { description };
        export { height };
        export { defaultText as default };
        export const aboveEditorSection: JSX.Element;
        export function mapStateToProps(state: any): {
            warning: string | null;
            readOnly: boolean;
        };
    }
    export { config_4 as config };
}
export namespace jsTooltip {
    const name_5: string;
    export { name_5 as name };
    export namespace config_5 { }
    export { config_5 as config };
}
export namespace jsOnclickHref {
    const name_6: string;
    export { name_6 as name };
    export namespace config_6 { }
    export { config_6 as config };
}
export namespace legendFormat {
    const name_7: string;
    export { name_7 as name };
    export namespace config_7 {
        const label_2: string;
        export { label_2 as label };
        const description_2: string;
        export { description_2 as description };
        const type_3: string;
        export { type_3 as type };
        export const clearable: boolean;
        const _default_2: string[];
        export { _default_2 as default };
        export { D3_FORMAT_OPTIONS as choices };
        const renderTrigger_1: boolean;
        export { renderTrigger_1 as renderTrigger };
    }
    export { config_7 as config };
}
export namespace legendPosition {
    const name_8: string;
    export { name_8 as name };
    export namespace config_8 {
        const label_3: string;
        export { label_3 as label };
        const description_3: string;
        export { description_3 as description };
        const type_4: string;
        export { type_4 as type };
        const clearable_1: boolean;
        export { clearable_1 as clearable };
        const _default_3: string;
        export { _default_3 as default };
        export const choices: (string | null)[][];
        const renderTrigger_2: boolean;
        export { renderTrigger_2 as renderTrigger };
    }
    export { config_8 as config };
}
export namespace lineColumn {
    const name_9: string;
    export { name_9 as name };
    export namespace config_9 {
        const type_5: string;
        export { type_5 as type };
        const label_4: string;
        export { label_4 as label };
        const _default_4: null;
        export { _default_4 as default };
        const description_4: string;
        export { description_4 as description };
        export function mapStateToProps_1(state: any): {
            choices: any;
        };
        export { mapStateToProps_1 as mapStateToProps };
        export const validators: (typeof validateNonEmpty)[];
    }
    export { config_9 as config };
}
export namespace lineWidth {
    const name_10: string;
    export { name_10 as name };
    export namespace config_10 {
        const type_6: string;
        export { type_6 as type };
        const label_5: string;
        export { label_5 as label };
        const renderTrigger_3: boolean;
        export { renderTrigger_3 as renderTrigger };
        export const isInt: boolean;
        const _default_5: number;
        export { _default_5 as default };
        const description_5: string;
        export { description_5 as description };
    }
    export { config_10 as config };
}
export namespace fillColorPicker {
    const name_11: string;
    export { name_11 as name };
    export namespace config_11 {
        const label_6: string;
        export { label_6 as label };
        const description_6: string;
        export { description_6 as description };
        const type_7: string;
        export { type_7 as type };
        export { PRIMARY_COLOR as default };
        const renderTrigger_4: boolean;
        export { renderTrigger_4 as renderTrigger };
    }
    export { config_11 as config };
}
export namespace strokeColorPicker {
    const name_12: string;
    export { name_12 as name };
    export namespace config_12 {
        const label_7: string;
        export { label_7 as label };
        const description_7: string;
        export { description_7 as description };
        const type_8: string;
        export { type_8 as type };
        export { PRIMARY_COLOR as default };
        const renderTrigger_5: boolean;
        export { renderTrigger_5 as renderTrigger };
    }
    export { config_12 as config };
}
export namespace filled {
    const name_13: string;
    export { name_13 as name };
    export namespace config_13 {
        const type_9: string;
        export { type_9 as type };
        const label_8: string;
        export { label_8 as label };
        const renderTrigger_6: boolean;
        export { renderTrigger_6 as renderTrigger };
        const description_8: string;
        export { description_8 as description };
        const _default_6: boolean;
        export { _default_6 as default };
    }
    export { config_13 as config };
}
export namespace stroked {
    const name_14: string;
    export { name_14 as name };
    export namespace config_14 {
        const type_10: string;
        export { type_10 as type };
        const label_9: string;
        export { label_9 as label };
        const renderTrigger_7: boolean;
        export { renderTrigger_7 as renderTrigger };
        const description_9: string;
        export { description_9 as description };
        const _default_7: boolean;
        export { _default_7 as default };
    }
    export { config_14 as config };
}
export namespace extruded {
    const name_15: string;
    export { name_15 as name };
    export namespace config_15 {
        const type_11: string;
        export { type_11 as type };
        const label_10: string;
        export { label_10 as label };
        const renderTrigger_8: boolean;
        export { renderTrigger_8 as renderTrigger };
        const _default_8: boolean;
        export { _default_8 as default };
        const description_10: string;
        export { description_10 as description };
    }
    export { config_15 as config };
}
export namespace gridSize {
    const name_16: string;
    export { name_16 as name };
    export namespace config_16 {
        const type_12: string;
        export { type_12 as type };
        const label_11: string;
        export { label_11 as label };
        const renderTrigger_9: boolean;
        export { renderTrigger_9 as renderTrigger };
        const _default_9: number;
        export { _default_9 as default };
        const isInt_1: boolean;
        export { isInt_1 as isInt };
        const description_11: string;
        export { description_11 as description };
    }
    export { config_16 as config };
}
export namespace viewport {
    const name_17: string;
    export { name_17 as name };
    export namespace config_17 {
        const type_13: string;
        export { type_13 as type };
        const label_12: string;
        export { label_12 as label };
        const renderTrigger_10: boolean;
        export { renderTrigger_10 as renderTrigger };
        const description_12: string;
        export { description_12 as description };
        export { DEFAULT_VIEWPORT as default };
        export const dontRefreshOnChange: boolean;
    }
    export { config_17 as config };
}
export namespace spatial {
    const name_18: string;
    export { name_18 as name };
    export namespace config_18 {
        const type_14: string;
        export { type_14 as type };
        const label_13: string;
        export { label_13 as label };
        const validators_1: (typeof validateNonEmpty)[];
        export { validators_1 as validators };
        const description_13: string;
        export { description_13 as description };
        export function mapStateToProps_2(state: any): {
            choices: any;
        };
        export { mapStateToProps_2 as mapStateToProps };
    }
    export { config_18 as config };
}
export namespace pointRadiusFixed {
    const name_19: string;
    export { name_19 as name };
    export namespace config_19 {
        const type_15: string;
        export { type_15 as type };
        const label_14: string;
        export { label_14 as label };
        namespace _default_10 {
            const type_16: string;
            export { type_16 as type };
            export const value: number;
        }
        export { _default_10 as default };
        const description_14: string;
        export { description_14 as description };
        export function mapStateToProps_3(state: any): {
            datasource: any;
        };
        export { mapStateToProps_3 as mapStateToProps };
    }
    export { config_19 as config };
}
export namespace multiplier {
    const name_20: string;
    export { name_20 as name };
    export namespace config_20 {
        const type_17: string;
        export { type_17 as type };
        const label_15: string;
        export { label_15 as label };
        export const isFloat: boolean;
        const renderTrigger_11: boolean;
        export { renderTrigger_11 as renderTrigger };
        const _default_11: number;
        export { _default_11 as default };
        const description_15: string;
        export { description_15 as description };
    }
    export { config_20 as config };
}
export namespace lineType {
    const name_21: string;
    export { name_21 as name };
    export namespace config_21 {
        const type_18: string;
        export { type_18 as type };
        const label_16: string;
        export { label_16 as label };
        const clearable_2: boolean;
        export { clearable_2 as clearable };
        const _default_12: string;
        export { _default_12 as default };
        const description_16: string;
        export { description_16 as description };
        const choices_1: string[][];
        export { choices_1 as choices };
    }
    export { config_21 as config };
}
export namespace reverseLongLat {
    const name_22: string;
    export { name_22 as name };
    export namespace config_22 {
        const type_19: string;
        export { type_19 as type };
        const label_17: string;
        export { label_17 as label };
        const _default_13: boolean;
        export { _default_13 as default };
    }
    export { config_22 as config };
}
export namespace mapboxStyle {
    const name_23: string;
    export { name_23 as name };
    export namespace config_23 {
        const type_20: string;
        export { type_20 as type };
        const label_18: string;
        export { label_18 as label };
        const clearable_3: boolean;
        export { clearable_3 as clearable };
        const renderTrigger_12: boolean;
        export { renderTrigger_12 as renderTrigger };
        const choices_2: string[][];
        export { choices_2 as choices };
        const _default_14: string;
        export { _default_14 as default };
        const description_17: string;
        export { description_17 as description };
    }
    export { config_23 as config };
}
export namespace geojsonColumn {
    const name_24: string;
    export { name_24 as name };
    export namespace config_24 {
        const type_21: string;
        export { type_21 as type };
        const label_19: string;
        export { label_19 as label };
        const validators_2: (typeof validateNonEmpty)[];
        export { validators_2 as validators };
        const description_18: string;
        export { description_18 as description };
        export function mapStateToProps_4(state: any): {
            choices: any;
        };
        export { mapStateToProps_4 as mapStateToProps };
    }
    export { config_24 as config };
}
import React from "react";
import { D3_FORMAT_OPTIONS } from "./controls";
import { validateNonEmpty } from "packages/superset-ui-core/src/validator";
import { PRIMARY_COLOR } from "./controls";
declare namespace DEFAULT_VIEWPORT {
    const longitude: number;
    const latitude: number;
    const zoom: number;
    const bearing: number;
    const pitch: number;
}
export {};
//# sourceMappingURL=Shared_DeckGL.d.ts.map
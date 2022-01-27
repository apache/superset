export namespace dndLineColumn {
    const name: string;
    const config: {
        label: string;
        description: string;
        type: "DndColumnSelect";
        default?: import("@superset-ui/core").JsonValue | undefined;
        renderTrigger?: boolean | undefined;
        validators?: import("@superset-ui/chart-controls").ControlValueValidator<"DndColumnSelect", import("@superset-ui/chart-controls").SelectOption, import("@superset-ui/core").JsonValue>[] | undefined;
        warning?: import("react").ReactNode;
        error?: import("react").ReactNode;
        mapStateToProps?: ((state: import("@superset-ui/chart-controls").ControlPanelState, controlState: import("@superset-ui/chart-controls").ControlState<import("@superset-ui/chart-controls").ControlType, import("@superset-ui/chart-controls").SelectOption>, chartState?: {
            [x: string]: any;
        } | undefined) => import("@superset-ui/chart-controls").ExtraControlProps) | undefined;
        visibility?: ((props: import("@superset-ui/chart-controls").ControlPanelsContainerProps) => boolean) | undefined;
    };
}
export namespace dndGeojsonColumn {
    const name_1: string;
    export { name_1 as name };
    const config_1: {
        label: string;
        description: string;
        type: "DndColumnSelect";
        default?: import("@superset-ui/core").JsonValue | undefined;
        renderTrigger?: boolean | undefined;
        validators?: import("@superset-ui/chart-controls").ControlValueValidator<"DndColumnSelect", import("@superset-ui/chart-controls").SelectOption, import("@superset-ui/core").JsonValue>[] | undefined;
        warning?: import("react").ReactNode;
        error?: import("react").ReactNode;
        mapStateToProps?: ((state: import("@superset-ui/chart-controls").ControlPanelState, controlState: import("@superset-ui/chart-controls").ControlState<import("@superset-ui/chart-controls").ControlType, import("@superset-ui/chart-controls").SelectOption>, chartState?: {
            [x: string]: any;
        } | undefined) => import("@superset-ui/chart-controls").ExtraControlProps) | undefined;
        visibility?: ((props: import("@superset-ui/chart-controls").ControlPanelsContainerProps) => boolean) | undefined;
    };
    export { config_1 as config };
}
//# sourceMappingURL=sharedDndControls.d.ts.map
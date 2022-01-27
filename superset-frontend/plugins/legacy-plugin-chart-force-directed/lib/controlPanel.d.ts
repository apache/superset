declare const _default: {
    controlPanelSections: (import("@superset-ui/chart-controls").ControlPanelSectionConfig | {
        label: string;
        expanded: boolean;
        controlSetRows: (string[] | {
            name: string;
            config: {
                type: string;
                label: string;
                description: string;
            };
        }[])[];
    })[];
    controlOverrides: {
        groupby: {
            label: string;
            description: string;
        };
    };
};
export default _default;
//# sourceMappingURL=controlPanel.d.ts.map
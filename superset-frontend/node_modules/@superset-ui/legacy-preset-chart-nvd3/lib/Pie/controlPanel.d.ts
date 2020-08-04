declare const _default: {
    controlPanelSections: {
        label: string;
        expanded: boolean;
        controlSetRows: (string[] | {
            name: string;
            config: {
                type: string;
                label: string;
                renderTrigger: boolean;
                default: boolean;
                description: string;
            };
        }[] | ({
            name: string;
            config: {
                type: string;
                label: string;
                default: string;
                renderTrigger: boolean;
                choices: string[][];
                description: string;
                freeForm?: undefined;
            };
        } | {
            name: string;
            config: {
                type: string;
                freeForm: boolean;
                label: string;
                renderTrigger: boolean;
                default: string;
                choices: string[][];
                description: string;
            };
        })[])[];
    }[];
    controlOverrides: {
        row_limit: {
            default: number;
        };
    };
};
export default _default;
//# sourceMappingURL=controlPanel.d.ts.map
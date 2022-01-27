declare namespace _default {
    const controlPanelSections: (import("@superset-ui/chart-controls").ControlPanelSectionConfig | {
        label: string;
        expanded: boolean;
        controlSetRows: (({
            name: string;
            config: {
                type: string;
                label: string;
                clearable: boolean;
                renderTrigger: boolean;
                choices: string[][];
                default: string;
                description: string;
            };
        } | {
            name: string;
            config: {
                type: string;
                label: string;
                renderTrigger: boolean;
                description: string;
                default: {
                    longitude: number;
                    latitude: number;
                    zoom: number;
                    bearing: number;
                    pitch: number;
                };
                dontRefreshOnChange: boolean;
            };
        })[] | ({
            name: string;
            config: {
                type: string;
                multi: boolean;
                label: string;
                validators: (typeof validateNonEmpty)[];
                default: never[];
                description: string;
                dataEndpoint: string;
                placeholder: string;
                onAsyncErrorMessage: string;
                mutator: (data: any) => any;
            };
        } | null)[])[];
    } | {
        label: string;
        expanded: boolean;
        controlSetRows: string[][];
    })[];
}
export default _default;
import { validateNonEmpty } from "packages/superset-ui-core/src/validator";
//# sourceMappingURL=controlPanel.d.ts.map
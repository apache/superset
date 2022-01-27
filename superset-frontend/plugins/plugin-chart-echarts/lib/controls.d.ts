/// <reference types="react" />
import { ControlPanelsContainerProps, ControlSetRow } from '@superset-ui/chart-controls';
export declare const legendSection: (JSX.Element[] | {
    name: string;
    config: {
        type: string;
        label: string;
        renderTrigger: boolean;
        default: boolean;
        description: string;
    };
}[] | {
    name: string;
    config: {
        type: string;
        freeForm: boolean;
        label: string;
        choices: string[][];
        default: import("./types").LegendType;
        renderTrigger: boolean;
        description: string;
        visibility: ({ controls }: ControlPanelsContainerProps) => boolean;
    };
}[] | {
    name: string;
    config: {
        type: string;
        freeForm: boolean;
        label: string;
        choices: string[][];
        default: import("./types").LegendOrientation;
        renderTrigger: boolean;
        description: string;
        visibility: ({ controls }: ControlPanelsContainerProps) => boolean;
    };
}[] | {
    name: string;
    config: {
        type: string;
        label: string;
        renderTrigger: boolean;
        isInt: boolean;
        default: string | number | null;
        description: string;
        visibility: ({ controls }: ControlPanelsContainerProps) => boolean;
    };
}[])[];
export declare const showValueSection: {
    name: string;
    config: {
        type: string;
        label: string;
        default: boolean;
        renderTrigger: boolean;
        description: string;
    };
}[][];
export declare const richTooltipSection: ControlSetRow[];
//# sourceMappingURL=controls.d.ts.map
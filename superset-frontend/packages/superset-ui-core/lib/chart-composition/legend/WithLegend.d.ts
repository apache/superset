import { CSSProperties, ReactNode, PureComponent } from 'react';
declare const defaultProps: {
    className: string;
    height: string | number;
    position: string;
    width: string | number;
};
declare type Props = {
    className: string;
    debounceTime?: number;
    width: number | string;
    height: number | string;
    legendJustifyContent?: 'center' | 'flex-start' | 'flex-end';
    position: 'top' | 'left' | 'bottom' | 'right';
    renderChart: (dim: {
        width: number;
        height: number;
    }) => ReactNode;
    renderLegend?: (params: {
        direction: string;
    }) => ReactNode;
} & Readonly<typeof defaultProps>;
declare class WithLegend extends PureComponent<Props, {}> {
    static defaultProps: {
        className: string;
        height: string | number;
        position: string;
        width: string | number;
    };
    getContainerDirection(): CSSProperties['flexDirection'];
    getLegendJustifyContent(): "center" | "flex-end" | "flex-start";
    render(): JSX.Element;
}
export default WithLegend;
//# sourceMappingURL=WithLegend.d.ts.map
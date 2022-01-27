import { CSSProperties, PureComponent, ReactNode } from 'react';
interface TooltipRowData {
    key: string | number;
    keyColumn?: ReactNode;
    keyStyle?: CSSProperties;
    valueColumn: ReactNode;
    valueStyle?: CSSProperties;
}
declare const defaultProps: {
    className: string;
    data: TooltipRowData[];
};
declare type Props = {
    className?: string;
    data: TooltipRowData[];
} & Readonly<typeof defaultProps>;
export default class TooltipTable extends PureComponent<Props, {}> {
    static defaultProps: {
        className: string;
        data: TooltipRowData[];
    };
    render(): JSX.Element;
}
export {};
//# sourceMappingURL=TooltipTable.d.ts.map
import React, { PureComponent } from 'react';
declare const defaultProps: {
    className: string;
};
declare type Props = {
    className?: string;
    children: React.ReactNode;
} & Readonly<typeof defaultProps>;
declare class TooltipFrame extends PureComponent<Props, {}> {
    static defaultProps: {
        className: string;
    };
    render(): JSX.Element;
}
export default TooltipFrame;
//# sourceMappingURL=TooltipFrame.d.ts.map
import React, { PureComponent } from 'react';
declare type Props = {
    contentWidth?: number;
    contentHeight?: number;
    height: number;
    renderContent: ({ height, width, }: {
        height: number;
        width: number;
    }) => React.ReactNode;
    width: number;
};
export default class ChartFrame extends PureComponent<Props, {}> {
    static defaultProps: {
        renderContent(): void;
    };
    render(): React.ReactNode;
}
export {};
//# sourceMappingURL=ChartFrame.d.ts.map
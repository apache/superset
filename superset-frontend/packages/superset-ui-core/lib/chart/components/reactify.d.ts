import React from 'react';
export declare type ReactifyProps = {
    id?: string;
    className?: string;
};
export declare type LifeCycleCallbacks = {
    componentWillUnmount?: () => void;
};
export interface RenderFuncType<Props> {
    (container: HTMLDivElement, props: Readonly<Props & ReactifyProps>): void;
    displayName?: string;
    defaultProps?: Partial<Props & ReactifyProps>;
    propTypes?: React.WeakValidationMap<Props & ReactifyProps>;
}
export default function reactify<Props extends object>(renderFn: RenderFuncType<Props>, callbacks?: LifeCycleCallbacks): React.ComponentClass<Props & ReactifyProps>;
//# sourceMappingURL=reactify.d.ts.map
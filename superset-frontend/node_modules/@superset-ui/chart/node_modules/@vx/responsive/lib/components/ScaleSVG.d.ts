import React from 'react';
export declare type ScaleSVGProps = {
    /** Child SVG to scale, rendered as the child of the parent wrappers provided by this component `<div><svg>{children}</svg></div>`. */
    children?: React.ReactNode;
    /** Width of the desired SVG. */
    width?: number | string;
    /** Height of the desired SVG. */
    height?: number | string;
    /** xOrigin of the desired SVG. */
    xOrigin?: number | string;
    /** yOrigin of the desired SVG. */
    yOrigin?: number | string;
    /** Whether to preserve SVG aspect ratio. */
    preserveAspectRatio?: string;
    /** Ref to the parent `<svg />` used for scaling. */
    innerRef?: React.Ref<SVGSVGElement>;
};
export default function ScaleSVG({ children, width, height, xOrigin, yOrigin, preserveAspectRatio, innerRef, }: ScaleSVGProps): JSX.Element;
//# sourceMappingURL=ScaleSVG.d.ts.map
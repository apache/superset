import { TextStyle, Dimension } from './types';
export interface GetTextDimensionInput {
    className?: string;
    container?: HTMLElement;
    style?: TextStyle;
    text: string;
}
export default function getTextDimension(input: GetTextDimensionInput, defaultDimension?: Dimension): Dimension;
//# sourceMappingURL=getTextDimension.d.ts.map
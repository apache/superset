import { TextStyle, Dimension } from './types';
/**
 * get dimensions of multiple texts with same style
 * @param input
 * @param defaultDimension
 */
export default function getMultipleTextDimensions(input: {
    className?: string;
    container?: HTMLElement;
    style?: TextStyle;
    texts: string[];
}, defaultDimension?: Dimension): Dimension[];
//# sourceMappingURL=getMultipleTextDimensions.d.ts.map
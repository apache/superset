import { NormalizedMessage } from '../NormalizedMessage';
/**
 * Create new code frame formatter.
 *
 * @param options Options for babel-code-frame - see https://www.npmjs.com/package/babel-code-frame
 * @returns {codeframeFormatter}
 */
export declare function createCodeframeFormatter(options: any): (message: NormalizedMessage, useColors: boolean) => string;

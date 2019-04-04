import { ReactElement } from 'react';

/**
 * Render a ReactElement to its initial HTML. This should only be used on the
 * server.
 * See https://facebook.github.io/react/docs/react-dom-stream.html#rendertostream
 */
export function renderToStream(element: ReactElement<any>): any;

/**
 * Similar to renderToStream, except this doesn't create extra DOM attributes
 * such as data-react-id that React uses internally.
 * See https://facebook.github.io/react/docs/react-dom-stream.html#rendertostaticstream
 */
export function renderToStaticStream(element: ReactElement<any>): any;
export const version: string;

export as namespace ReactDOMNodeStream;

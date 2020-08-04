/* @flow */
import ReactDOMServer from 'react-dom/server';
import React from 'react';
import { StyleSheetServer } from '../../src/index.js';

import StyleTester from './StyleTester.js';

export default function() {
    const data = StyleSheetServer.renderStatic(
        () => ReactDOMServer.renderToString(<StyleTester />));

    return `
        <!doctype html>
        <html>
            <head>
                <meta charset="utf-8">
                <style data-aphrodite>${data.css.content}</style>
            </head>
            <body>
                <div id="root">${data.html}</div>
                <script>window.renderedClassNames = ${JSON.stringify(data.css.renderedClassNames)};</script>
                <script src="./bundle.js"></script>
            </body>
        </html>
    `;
}

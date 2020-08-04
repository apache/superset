/* @flow */
import ReactDOM from 'react-dom';
import React from 'react';
import { StyleSheet } from '../../src/index.js';

import StyleTester from './StyleTester.js';

const root = document.getElementById('root');

StyleSheet.rehydrate(window.renderedClassNames);
if (root) {
    ReactDOM.render(
        <StyleTester />,
        root
    );
}

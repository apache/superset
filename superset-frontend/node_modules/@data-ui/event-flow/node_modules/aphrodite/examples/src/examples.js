/* @flow */
import ReactDOM from 'react-dom';
import React from 'react';
import { StyleSheet } from '../../src/index.js';

import StyleTester from './StyleTester.js';

StyleSheet.rehydrate(window.renderedClassNames);
ReactDOM.render(
    <StyleTester />,
    document.getElementById('root'));

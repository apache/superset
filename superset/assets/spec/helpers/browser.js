/* eslint no-undef: 0, no-native-reassign: 0 */
import 'babel-polyfill';
import chai from 'chai';
import jsdom from 'jsdom';
import { SupersetClient } from '../../src/packages/core/src';
import fetchMock from 'fetch-mock'; // eslint-disable-line import/first

require('babel-register')({
  // NOTE: If `dynamic-import-node` is in .babelrc alongside
  // `syntax-dynamic-import` it breaks webpack's bundle splitting capability.
  // So only load during runtime on the node-side (in tests)
  plugins: ['dynamic-import-node'],
});

const exposedProperties = ['window', 'navigator', 'document'];

global.jsdom = jsdom.jsdom;
global.document = global.jsdom('<!doctype html><html><body></body></html>');
global.window = document.defaultView;
global.HTMLElement = window.HTMLElement;

Object.keys(document.defaultView).forEach((property) => {
  if (typeof global[property] === 'undefined') {
    exposedProperties.push(property);
    global[property] = document.defaultView[property];
  }
});

global.navigator = {
  userAgent: 'node.js',
  platform: 'linux',
  appName: 'Netscape',
};

// Configuration copied from https://github.com/sinonjs/sinon/issues/657
// allowing for sinon.fakeServer to work

global.window = global.document.defaultView;
global.XMLHttpRequest = global.window.XMLHttpRequest;

global.sinon = require('sinon');

global.expect = chai.expect;
global.assert = chai.assert;

global.sinon.useFakeXMLHttpRequest();

global.window.XMLHttpRequest = global.XMLHttpRequest;
global.window.location = { href: 'about:blank' };
global.window.performance = { now: () => new Date().getTime() };
global.$ = require('jquery')(global.window);

// The following are needed to mock out SupersetClient requests
// including CSRF authentication and initialization
global.FormData = window.FormData;
fetchMock.get('glob:*superset/csrf_token/*', { csrf_token: '1234' });
SupersetClient.configure({ protocol: 'http', host: 'localhost' })
  .init()
  .then(() => fetchMock.reset()); // remove this call from mocks

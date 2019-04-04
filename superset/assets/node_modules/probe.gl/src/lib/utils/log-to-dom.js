/* eslint-disable no-console */
import {document, console, global} from './globals';

let old = null;

// Can log a (not too long) number of messages to a div in the DOM
export function enableDOMLogging(enable = true) {
  // First time, add a log div
  if (enable && !old) {
    old = console.log.bind(console);
    console.log = (...args) => {
      logLineToDOM(...args);
      old(...args);
    };
  }
  if (!enable && old) {
    console.log = old;
    old = null;
  }
}

let logDiv = null;

export function logLineToDOM(message) {
  if (!logDiv) {
    const markdown = global.probe.markdown;
    logDiv = document.createElement(markdown ? 'pre' : 'div');
  }
  // Ensure the element comes first
  const {childNodes} = document.body;
  document.body.insertBefore(logDiv, childNodes && childNodes[0]);

  // Add the line to the log element
  if (typeof message === 'string') {
    logDiv.innerHTML += `${message}<br />`;
  }
}

export default enableDOMLogging;

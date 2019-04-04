/* global window */
export function callExposedFunction(exposedFunction, result) {
  // Node test driver (puppeteer) may not have had time to expose the function
  // if the test suite is short. If not available, wait a second and try again
  if (window[exposedFunction]) {
    const resultString = JSON.stringify(result);
    console.error(`Calling exposed function ${exposedFunction}(${resultString})`); // eslint-disable-line
    window[exposedFunction](resultString);
  } else {
    console.warn(`window.${exposedFunction}() not yet exposed, waiting 1 second`); // eslint-disable-line
    window.setTimeout(callExposedFunction.bind(null, exposedFunction, result), 1000);
  }
}

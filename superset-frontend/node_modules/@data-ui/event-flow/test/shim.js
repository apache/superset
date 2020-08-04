// polyfill for React 16 https://github.com/facebook/react/issues/9102#issuecomment-283873039
global.requestAnimationFrame = callback => {
  setTimeout(callback, 0);
};

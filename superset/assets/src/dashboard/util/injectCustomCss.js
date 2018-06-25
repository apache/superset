export default function injectCustomCss(css) {
  const className = 'CssEditor-css';
  const head = document.head || document.getElementsByTagName('head')[0];
  let style = document.querySelector(`.${className}`);

  if (!style) {
    style = document.createElement('style');
    style.className = className;
    style.type = 'text/css';
    head.appendChild(style);
  }
  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.innerHTML = css;
  }
}

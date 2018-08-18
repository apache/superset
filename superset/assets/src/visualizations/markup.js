import './markup.css';

const srcdoc = require('srcdoc-polyfill');

function markupWidget(slice, payload) {
  const { selector } = slice;
  const height = slice.height();
  const headerHeight = slice.headerHeight();
  const vizType = slice.props.vizType;
  const { data } = payload;

  // Old code not working. There is no #code element.
  // $('#code').attr('rows', '15');
  // document.getElementById('brace-editor')
  //   .setAttribute('rows', 15);

  const container = document.querySelector(selector);
  container.style.overflow = 'auto';

  // markup height is slice height - (marginTop + marginBottom)
  const iframeHeight = vizType === 'separator'
    ? height - 20
    : height + headerHeight;

  const html = `
    <html>
      <head>
        ${data.theme_css.map(
          href => `<link rel="stylesheet" type="text/css" href="${href}" />`,
        )}
      </head>
      <body style="background-color: transparent;">
        ${data.html}
      </body>
    </html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('frameborder', 0);
  iframe.setAttribute('height', iframeHeight);
  iframe.setAttribute('sandbox', 'allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation');
  container.appendChild(iframe);

  srcdoc.set(iframe, html);
}

export default markupWidget;

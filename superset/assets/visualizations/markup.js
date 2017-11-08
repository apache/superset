const srcdoc = require('srcdoc-polyfill');

require('./markup.css');

function markupWidget(slice, payload) {
  $('#code').attr('rows', '15');
  const jqdiv = slice.container;
  jqdiv.css({
    overflow: 'auto',
  });

  const iframeId = `if__${slice.containerId}`;
  const html = `
    <html>
      <head>
        <link rel="stylesheet" type="text/css" href="${payload.data.theme_css}" />
      </head>
      <body style="background-color: transparent;">
        ${payload.data.html}
      </body>
    </html>`;
  jqdiv.html(`
    <iframe id="${iframeId}"
      frameborder="0"
      height="${slice.height() - 20}"
      sandbox="allow-same-origin allow-scripts allow-top-navigation allow-popups">
    </iframe>
  `);

  const iframe = document.getElementById(iframeId);
  srcdoc.set(iframe, html);
}

module.exports = markupWidget;

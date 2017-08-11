const $ = require('jquery');

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
      height="${slice.height()}"
      sandbox="allow-scripts">
    </iframe>`);
  $('#' + iframeId)[0].srcdoc = html;
}

module.exports = markupWidget;

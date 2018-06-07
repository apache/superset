const srcdoc = require('srcdoc-polyfill');

require('./markup.css');

function markupWidget(slice, payload) {
  $('#code').attr('rows', '15');
  const jqdiv = slice.container;
  jqdiv.css({
    overflow: 'auto',
  });

  // markup height is slice height - (marginTop + marginBottom)
  let iframeHeight = slice.height() - 20;
  if (slice.props.vizType === 'separator') {
    // separator height is the entire chart container: slice height + header
    iframeHeight = slice.height() + slice.headerHeight();
  }

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
      height="${iframeHeight}"
      sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation">
    </iframe>
  `);

  const iframe = document.getElementById(iframeId);
  srcdoc.set(iframe, html);
}

module.exports = markupWidget;

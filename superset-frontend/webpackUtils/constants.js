// The same as in package JSON
const DODOIS_CDN_PATH =
  'https://cdn.dodostatic.net/dodois-static/shared-frontends';
const DODOIS_DEV_CDN_PATH =
  'https://dodopizzadev-a.akamaihd.net/dodois-static/shared-frontends';

const PROD_OUTPUT_FOLDER = 'public';
const DEV_OUTPUT_FOLDER = 'public';

const MICROFRONTEND_NAME = 'supersetDashboardPlugin';
const SELECTOR_ID = `single-spa-application:${MICROFRONTEND_NAME}`;

// dir for static files
const STATIC_FILES_DIR = './';

const getHtmlTemplate = htmlWebpackPlugin => `<!DOCTYPE html>
<html lang="en">

  <head>
    <div id="some-element"></div>
    <link
      href="https://dodopizza-a.akamaihd.net/backoffice-static/bootstrap/4.3.1/css/bootstrap.min.css"
      rel="stylesheet"
    />
    <link
      href="https://dodopizza-a.akamaihd.net/static/antd/4.16.6/antd.min.css"
      rel="stylesheet"
    />
  </head>
  <body>
    <style>
      .all {
        width: 100%;
        min-height: calc(100% - 105px);
        height: auto;
        position: relative;
      }
      .wrap {
        height: auto;
        min-height: 100%;
        padding-bottom: 60px;
        position: relative;
      }
      .header {
        border-bottom: 1px solid #e4e4e4;
        height: 132px;
      }
      .content {
        padding: 10px 15px 0;
      }
      .middleColumn {
        width: 100%;
        float: left;
      }
    </style>
    <div class="all">
      <div class="wrap">
        <header class="header"></header>
        <section class="content">
          <section class="middleColumn">
            <div class="middleColumn_padding">
              <div id="${SELECTOR_ID}" style="width: 100%;"></div>
            </div>
            <script
              src="https://cdnjs.cloudflare.com/ajax/libs/systemjs/6.8.3/system.js"
              integrity="sha512-e77b00UHTqTXXo8ZEHATvvSIm7CETY1K+4wJyXHD6NHeoyvyOYePB4lkX5KDBFilzzbPHLvaQTJSrnwG8To3tQ=="
              crossorigin="anonymous"
            ></script>

            <script
              src="https://cdnjs.cloudflare.com/ajax/libs/single-spa/5.9.0/umd/single-spa.dev.js"
              integrity="sha512-cRqNv22eeCQFtRCgwNIaOW5HXs/NKWc64XrJEk5eLQ4mmdIzeceuEBiQ4zRgLutAhsiZP47z4+f2MYAfvuNGfw=="
              crossorigin="anonymous"
            ></script>

            <script>
              console.log('htmlWebpackPlugin', ${JSON.stringify(htmlWebpackPlugin.files.js)});
              singleSpa.registerApplication(
              "${MICROFRONTEND_NAME}",
              () => System.import(${JSON.stringify(
                htmlWebpackPlugin.files.js.map(
                  file =>
                    `${
                      file.includes('https')
                        ? file
                        : `./${file}`
                    }`,
                ).filter(entry => entry.includes('supersetDashboardPlugin'))[0],
              )}),
              () => true,
              ${JSON.stringify({ token: '' })}
            )
            singleSpa.start()
            </script>
          </section>
        </section>
      </div>
    </div>
    <style>
      .footer {
        box-sizing: border-box;
        border-top: 1px solid #e7e7e7;
        padding-top: 20px;
        padding-bottom: 50px;
      }
    </style>
    <footer class="footer">
      <div class="container">
        <div class="footer__inner">
          <div class="footer__copyright">©&nbsp;2023 Dodo Pizza</div>
        </div>
      </div>
    </footer>
  </body>
</html>
`;

module.exports = {
  DODOIS_CDN_PATH,
  DODOIS_DEV_CDN_PATH,
  PROD_OUTPUT_FOLDER,
  DEV_OUTPUT_FOLDER,
  MICROFRONTEND_NAME,
  SELECTOR_ID,
  STATIC_FILES_DIR,
  getHtmlTemplate,
};

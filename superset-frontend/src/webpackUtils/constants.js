/* eslint-disable theme-colors/no-literal-colors */
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
  </head>
  <body>
    <style>
      .all {
        width: 100%;
        height: auto;
        position: relative;
      }
      .wrap {
        height: auto;
        min-height: 100%;
        padding-bottom: 60px;
        position: relative;
      }
      header.header {
        border-bottom: 1px solid #e4e4e4;
        display: flex;
        align-items: center;
      }
      .content {
        padding: 10px 15px 0;
      }
      .middleColumn {
        width: 100%;
        float: left;
      }

      .navigation {
        list-style: none;
        margin-bottom: 0;
        padding-left: 20px;
      }
      .navigation_item {
        display: inline-block;
      }
      .navigation_item:last-of-type {
        margin-right: 0;
      }
      .navigation_link {
        color: #000;
        margin-bottom: -1px;
        padding: 10px 15px;
        display: block;
      }
      .navigation_link:hover {
        text-decoration: none;
      }
      .navigation_link--active {
        padding: 0 15px;
      }
      .navigation_link--active .navigation_linkBorderBlock {
        color: #e11717;
        border-bottom: 3px solid #e11717;
        padding: 8px 0;
        display: block;
      }
    </style>
    <div class="all">
      <div class="wrap">
        <header class="header">
          <ul class="navigation">
            <li class="navigation_item">
              <a class="navigation_link">
                <span class="navigation_linkBorderBlock">День</span>
              </a>
            </li>
            <li class="navigation_item">
              <a href="#" class="navigation_link">
                <span class="navigation_linkBorderBlock">Месяц</span>
              </a>
            </li>
            <li class="navigation_item">
              <a href="#/ScheduleDay" class="navigation_link">
                <span class="navigation_linkBorderBlock">График</span>
              </a>
            </li>
            <li class="navigation_item">
              <a href="#" class="navigation_link">
                <span class="navigation_linkBorderBlock">Команда</span>
              </a>
            </li>
            <li class="navigation_item">
              <a href="#" class="navigation_link">
                <span class="navigation_linkBorderBlock">Отчёты</span>
              </a>
            </li>
            <li class="navigation_item">
              <a href="#" class="navigation_link">
                <span class="navigation_linkBorderBlock">Метрики</span>
              </a>
            </li>
            <li class="navigation_item">
              <a href="#" class="navigation_link">
                <span class="navigation_linkBorderBlock">Учёт</span>
              </a>
            </li>
            <li class="navigation_item">
              <a href="#" class="navigation_link">
                <span class="navigation_linkBorderBlock">Маркетинг</span>
              </a>
            </li>
            <li class="navigation_item">
              <a href="#/ZoneSettings" class="navigation_link">
                <span class="navigation_linkBorderBlock">Настройки</span>
              </a>
            </li>
            <li class="navigation_item">
              <a href="#" class="navigation_link navigation_link--special">
                <span class="navigation_linkBorderBlock">Новости Додо</span>
              </a>
            </li>
            <li class="navigation_item navigation_link--active">
              <a href="#" class="navigation_link">
                <span class="navigation_linkBorderBlock">Аналитика</span>
              </a>
            </li>
          </ul>
        </header>
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
              singleSpa.registerApplication(
              "${MICROFRONTEND_NAME}",
              () => System.import(${JSON.stringify(
                htmlWebpackPlugin.files.js
                  .map(file => `${file.includes('https') ? file : `./${file}`}`)
                  .filter(entry =>
                    entry.includes('supersetDashboardPlugin'),
                  )[0],
              )}),
              () => true,
              ${JSON.stringify({
                token: '',
                originUrl: '/superset',
                businessId: 'dodopizza',
                navigation: {
                  showNavigationMenu: true,
                  base: '/OfficeManager/Analytics/',
                },
              })}
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
          <div class="footer__select-lang">


<style>
	.selectLanguage {
		width: 150px;
		display: inline-block;
		vertical-align: middle;		
	}

	.selectLanguage_lang {
		height: 34px;
		width: 100%;
		max-width: 150px;
		padding: 5px;
		-webkit-border-radius: 2px;
		-moz-border-radius: 2px;
		border-radius: 2px;
		background-color: #fff;
		border: 1px solid #ccc;
		font-size: 14px;
		color: #000;
		-webkit-box-shadow: inset 0 4px 4px -4px #dadada;
		-moz-box-shadow: inset 0 4px 4px -4px #dadada;
		box-shadow: inset 0 4px 4px -4px #dadada;
	}
</style>

<div class="selectLanguage">
	<form id="changeLanguage" method="POST" action="/Infrastructure/Home/ChangeCulture">

		<select class="selectLanguage_lang" name="lang" onchange="$.blockUI(); document.getElementById('changeLanguage').submit();">
        <option selected="" value="ru-RU">русский (Россия)</option>
        <option value="en-GB">English (United Kingdom)</option>
    </select>

    <input id="Role" name="Role" type="hidden" value="">

  </form>
</div></div>
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

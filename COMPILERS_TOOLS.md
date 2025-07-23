# Компиляторы и средства разработки

Этот документ содержит перечень основных компиляторов и инструментов, 
использованных при разработке Apache Superset.

- **Python** \(версия 3.10 и выше\) — основной язык серверной части проекта. 
  Требуемая версия указана в файле [`pyproject.toml`](./pyproject.toml) строка 27.
- **Node.js** 20 и **npm** 10 применяются при сборке фронтенд‑части. 
  Сведения о версиях приведены в [документации по разработке](docs/docs/contributing/development.mdx), строки 326–329.
- **Node.js** 16 и **npm** 7/8 используются для генерации плагинов визуализаций. 
  См. [раздел Howtos](docs/docs/contributing/howtos.mdx), строки 52–57.
- **TypeScript** 5.1.6 — компилятор TypeScript, версия указана в 
  [`superset-frontend/package.json`](./superset-frontend/package.json) строка 345.
- **Webpack** 5.98.0 и **Babel** 7.26 — сборщики и транспиляторы JavaScript. 
  Версии приведены в [`package.json`](./superset-frontend/package.json).
- **GCC** — системный компилятор C/C++, требуемый для сборки некоторых зависимостей 
  Python. Инструкция по установке содержится в файле 
  [`docs/docs/installation/pypi.mdx`](docs/docs/installation/pypi.mdx) строки 40–48.


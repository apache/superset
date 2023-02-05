# DODO SUPERSET FRONTEND

## Start docker

in the root directory perform
```
docker-compose -f docker-compose.yml up
```

The core version is going to run on http://localhost:8088/
The version for development is going to run on http://localhost:9000/


## for local development of superset-ui plugins

1. Remove `node_modules`
2. Execute this code in `superset/superset-frontend` directory

```
npm install && npm link ../../superset-ui/plugins/legacy-plugin-chart-pivot-table ../../superset-ui/plugins/plugin-chart-echarts ../../superset-ui/plugins/legacy-preset-chart-nvd3 ../../superset-ui/plugins/plugin-chart-pivot-table
```

3. Be sure that your plugin version in `package.json` matches the version in superset-ui repo (that you are linking to)
4. If everything ran smoothly - open localhost:8088 (to ensure that docker image is running)
5. if it run smoothly and you are ready for local development, run:
```
npm run dev-server
```
It will be a proxy to localhost:8088 and will be running on localhost:9000
6. To ensure that all packages are linked, after running `npm run dev-server` you should see in the output in the console:
```
npm run dev-server

> superset@1.3.1 dev-server /Users/a.kazakov/WORK/DODO/DEV/DE/superset/superset-frontend
> cross-env NODE_ENV=development BABEL_ENV=development node --max_old_space_size=4096 ./node_modules/webpack-dev-server/bin/webpack-dev-server.js --mode=development

[Superset Plugin] Use symlink source for @superset-ui/legacy-plugin-chart-pivot-table @ ^0.17.41
[Superset Plugin] Use symlink source for @superset-ui/legacy-preset-chart-nvd3 @ ^0.17.41
[Superset Plugin] Use symlink source for @superset-ui/plugin-chart-echarts @ ^0.17.84
[Superset Plugin] Use symlink source for @superset-ui/plugin-chart-pivot-table @ ^0.17.41

```

P.S. If everything is linked and there are no errors and you are on the localhost:9000, when you update the file from those linked plugins - you will have hot reload on your :9000.

*this is until we switch to .npmrc*


## Checking the production version

If you are ready to deploy and there is no errors in the console while running `npm run dev-server`, be sure to run `npm run build`. The nasty errors might apper in PRODUCTION mode and NOT appear in DEVELOPMENT mode.

```
npm install && npm install ../../superset-ui/plugins/legacy-plugin-chart-pivot-table ../../superset-ui/plugins/plugin-chart-echarts ../../superset-ui/plugins/legacy-preset-chart-nvd3 ../../superset-ui/plugins/plugin-chart-pivot-table
```

You should see a message in the end of the output
```
+ @superset-ui/legacy-plugin-chart-pivot-table@0.17.41
+ @superset-ui/legacy-preset-chart-nvd3@0.17.41
+ @superset-ui/plugin-chart-echarts@0.17.84
+ @superset-ui/plugin-chart-pivot-table@0.17.41
removed XX packages, updated XX packages and audited XXXX packages in XX.XXs

```
When commiting, do not forget to change the `package.json` file back

## Important change from November 2021

Instead of linking the `superset-ui` plugins using npm link, we now have a dodo npm

## Superset login/pass

```
login: admin
password: admin

```

## When developing localy you need to change some files, without commiting them later:

`.npmrc` file:
```
you need to get the token to install the superset-ui plugins
```

`docker-compose.yml` file:

```
x-superset-image: &superset-image apache/superset:latest-dev
=>
x-superset-image: &superset-image apache/superset:1.3.1
```

`config.py` file:

```
"DASHBOARD_NATIVE_FILTERS": False
=>
"DASHBOARD_NATIVE_FILTERS": True
```

## How to release this to the dev stage (https://superset.dodois.ru/) and PROD (https://analytics.dodois.io/)?

1. Merge everything to the branch `dodo-frontend-1.3.1` (November 2021)
2. Go to the repo https://github.com/dodopizza/superset-plugins/actions
3. Actions -> Build Frontend

> `Superset frontend branch`
```
dodo-frontend-1.3.1
```

> `Superset UI branch`
```
dodo-plugins-0.17.41
```

**Wait until this job is done and green.**

4. Actions -> Build Backend
> `Superset backend branch`
```
add-kusto-support-1.3.1
```

**Wait until this job is done and green.**

5. Go to Slack and release, using Yunga

```
/yunga images superset
```

```
Last 10 app versions:
 | Tag                                      | Last update (UTC)   |
 |----------------------------------------------------------------|
 | main-0fc46f1-312768185                   | 02/02/2022 08:28:26 |
 | main-0fc46f1-871965247                   | 01/12/2022 12:55:46 |
 | prod-cors-10314d1-581888879              | 01/12/2022 10:22:13 |
 | gunicorn_to_prometheus-4f46ceb-448680323 | 01/12/2022 10:07:16 |
 | main-84c2e5e-047371347                   | 01/12/2022 09:04:22 |
 | sqlalchemy-kusto-a85faff-100934666       | 01/12/2022 08:46:43 |
 | gunicorn_to_prometheus-4d81197-084830501 | 12/29/2021 22:15:45 |
 | gunicorn_to_prometheus-1226634-095810095 | 12/29/2021 21:38:20 |
 | sqlalchemy-kusto-f37a621-652147031       | 12/29/2021 14:59:23 |
 | sqlalchemy-kusto-4916427-980701248       | 12/29/2021 12:55:38 |
```

We need `main-0fc46f1-312768185`

6. Release on dev stage

```
/yunga promote superset dev dev superset main-0fc46f1-312768185
```

7. Release on dev stage

```
/yunga promote superset prod we superset main-0fc46f1-312768185
```

8. You are amazing

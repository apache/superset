# DODO SUPERSET FRONTEND

## Local requirements for backend

Create a file  `docker/requirements-local.txt` with this content:
```
sqlalchemy-kusto==2.0.1
flask-http-middleware==0.4.2
marshmallow-enum==1.5.1

```
## Start docker
In order to start development in the root directory perform
```
docker-compose -f docker-compose.yml up
```

The core version is going to run on http://localhost:8088/

## Developing frontend (standalone)
If you want to develop frontend part (standalone) in the `superset-frontend` directory perform

```
npm run dev-server
```

The version for development is going to run on http://localhost:9000/

## Developing frontend (plugin)
If you want to develop frontend part (plugin) in the `superset-frontend` directory perform

```
npm run pl:dev-server
```
The version for development is going to run on http://localhost:3000/

## Superset login/pass

```
login: admin
password: admin

```

## When developing localy you need to change some files, without commiting them later:

`config.py` file:

```
"DASHBOARD_NATIVE_FILTERS": False
=>
"DASHBOARD_NATIVE_FILTERS": True
# add languages
LANGUAGES = {
    "en": {"flag": "us", "name": "English"},
    "ru": {"flag": "ru", "name": "Russian"},
}
```

## How to release this to the dev stage (https://superset.dodois.ru/) and PROD (https://analytics.dodois.io/)?

1. Merge everything to the branch `3.0-dodo` (March 2024)
2. Go to the repo https://github.com/dodopizza/superset-plugins/actions
3. Actions -> Build Frontend

> `Superset frontend branch`
```
3.0-dodo
```
!Deprecated
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

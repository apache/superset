# Superset Docker 本地开发与部署指南

本文整理当前工作区使用 Docker 和本机 Python 环境运行 Superset 的常用流程，以及元数据库、依赖和启动故障的处理方式。

## 目录

- [选择运行模式](#选择运行模式)
- [Docker 构建部署](#docker-构建部署)
  - [配置元数据库](#配置元数据库)
  - [端口与健康检查](#端口与健康检查)
  - [初始化与日志](#初始化与日志)
  - [更新镜像与代码](#更新镜像与代码)
  - [构建生产镜像包](#构建生产镜像包)
  - [设置中文界面](#设置中文界面)
- [前端 Docker、后端本机](#前端-docker后端本机)
  - [启动前端容器](#启动前端容器)
  - [启动本机后端](#启动本机后端)
  - [PyCharm 配置](#pycharm-配置)
- [Windows 依赖：python-ldap](#windows-依赖python-ldap)
- [常见问题](#常见问题)
  - [SECRET_KEY 与已有元数据](#secret_key-与已有元数据)
- [部署到其他服务器](#部署到其他服务器)

## 选择运行模式

| 场景 | Compose 文件 | 适用情况 |
| --- | --- | --- |
| 日常源码开发 | `docker-compose.yml` | 挂载本地源码，支持前端热更新。 |
| 构建镜像后运行 | `docker-compose-non-dev.yml` | 将当前源码与依赖构建进镜像，接近部署环境。 |
| Docker 前端、本机后端 | `docker-compose.yml` + `docker-compose.backend-local.yml` | 调试 Python 后端，同时保留 Docker 前端环境。 |

## Docker 构建部署

使用 `docker-compose-non-dev.yml` 时，先构建镜像，再在后台启动服务：

```powershell
docker compose -f docker-compose-non-dev.yml build
docker compose -f docker-compose-non-dev.yml up -d
```

### 配置元数据库

元数据库配置位于 `docker/.env-local`。当前挂载的 `docker/pythonpath_dev/superset_config.py` 会根据 `DATABASE_*` 变量拼接 `SQLALCHEMY_DATABASE_URI`，因此使用该配置文件时应直接维护 `DATABASE_DIALECT`、`DATABASE_HOST`、`DATABASE_PORT`、`DATABASE_DB`、`DATABASE_USER` 和 `DATABASE_PASSWORD`。

```env
SUPERSET_LOAD_EXAMPLES=no
SUPERSET_SECRET_KEY=replace_with_a_fixed_strong_secret
DATABASE_DIALECT=mysql
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_DB=superset
DATABASE_USER=superset
DATABASE_PASSWORD=password

SUPERSET_PORT=8088
REDIS_PORT=6379
```

不要在使用 `docker/pythonpath_dev/superset_config.py` 时只设置 `SUPERSET__SQLALCHEMY_DATABASE_URI` 后忽略 `DATABASE_*`。该文件不会用 `SUPERSET__SQLALCHEMY_DATABASE_URI` 覆盖主元数据库连接。

`mysql://...` 会使用 SQLAlchemy 的 mysqldb 方言，需要安装 `mysqlclient`，该依赖会提供 `MySQLdb` 模块。当前环境按 MySQL 方式支持数据库连接，因此保持：

```env
DATABASE_DIALECT=mysql
```

并安装：

```text
mysqlclient
```

`docker/pythonpath_dev/superset_config.py` 会根据 `DATABASE_DIALECT` 同时拼接 `SQLALCHEMY_DATABASE_URI` 与 `SQLALCHEMY_EXAMPLES_URI`。将其设为 `mysql` 时，若镜像没有 `mysqlclient`，初始化或连接测试会报 `No module named 'MySQLdb'`。

`mysqlclient` 不是纯 Python 依赖，源码构建时需要 C 编译器、`pkg-config` 和 MySQL/MariaDB 开发库。当前 `Dockerfile` 的 `lean` 与 `dev` target 都已安装 `build-essential`、`pkg-config`、`default-libmysqlclient-dev`，且 `docker/requirements-local.txt` 已固定 `mysqlclient==2.2.8`。如果仍然看到 `No module named 'MySQLdb'`，优先重新构建当前镜像：

```powershell
docker compose -f docker-compose-non-dev.yml build --no-cache
docker compose -f docker-compose-non-dev.yml up -d
```

不要只在缺少系统构建依赖的旧运行时镜像里通过 `docker/requirements-local.txt` 加 `mysqlclient`，否则会在 `superset-init` 中构建失败并出现 `pkg-config: not found`。修改 `Dockerfile` 或 `docker/requirements-local.txt` 后必须重新构建镜像。

数据库 URI 所用驱动对应关系：

| URI | 所需依赖 |
| --- | --- |
| `mysql://...` | `mysqlclient` |

当前 `docker/requirements-local.txt` 内容为：

```text
mysqlclient==2.2.8
```

修改后执行：

```powershell
docker compose -f docker-compose-non-dev.yml build
```

### 端口与健康检查

`docker-compose-non-dev.yml` 将宿主机 `8088` 映射到容器内 `8088`，因此应保持：

```env
SUPERSET_PORT=8088
REDIS_PORT=6379
```

不要在该 Compose 文件下设置 `SUPERSET_PORT=8089`。否则 Gunicorn 会在容器内监听 `8089`，而访问 `http://localhost:8088` 会得到空响应。

验证服务：

```powershell
curl.exe http://localhost:8088/health
```

预期输出：

```text
OK
```

### 初始化与日志

`superset-init` 应正常完成并退出：

```text
superset_init  Exited (0)
```

常用命令：

```powershell
# 手动执行初始化
docker compose -f docker-compose-non-dev.yml run --rm superset-init

# 启动服务
docker compose -f docker-compose-non-dev.yml up -d

# 查看容器状态
docker compose -f docker-compose-non-dev.yml ps -a

# 查看服务日志
docker compose -f docker-compose-non-dev.yml logs --tail=300 superset
docker compose -f docker-compose-non-dev.yml logs --tail=300 superset-init
```

### 更新镜像与代码

`docker-compose-non-dev.yml` 将应用源码和依赖构建进镜像。修改以下内容后，需要重新构建相关镜像并重启容器：

- Python 后端源码或 React/TypeScript 前端源码
- Python、Node.js 或系统依赖
- Dockerfile 或镜像构建配置

构建并启动所有受影响服务：

```powershell
docker compose -f docker-compose-non-dev.yml up -d --build
```

只更新 Superset 应用镜像时：

```powershell
docker compose -f docker-compose-non-dev.yml build superset
docker compose -f docker-compose-non-dev.yml up -d superset
```

更新包含数据库迁移时：

```powershell
docker compose -f docker-compose-non-dev.yml build
docker compose -f docker-compose-non-dev.yml run --rm superset-init
docker compose -f docker-compose-non-dev.yml up -d
```

以下修改通常无需重新构建镜像：

- 仅修改通过 volume 挂载的配置文件
- 仅修改 `.env-local` 等运行时环境变量
- 仅修改文档、测试或未被镜像使用的文件

运行时配置变更后，重新创建容器即可；如果配置会在重启时重新读取，也可以只重启服务：

```powershell
docker compose -f docker-compose-non-dev.yml up -d
docker compose -f docker-compose-non-dev.yml restart
```

Docker 会复用构建缓存，但修改前端依赖或较早镜像层时，构建仍可能耗时较长。日常频繁开发建议使用 `docker-compose.yml`，无需在每次代码修改后重新构建。

### 构建生产镜像包

`docker-compose-non-dev.yml` 中 Superset 服务默认仍使用 Dockerfile 的 `dev` target。需要导出部署到服务器的生产镜像包时，叠加 `docker-compose-prod-export.yml`，将 Superset 应用镜像构建为 `lean` target：

`docker-compose-prod-export.yml` 应启用翻译包构建：

```yaml
args:
  DEV_MODE: "false"
  BUILD_TRANSLATIONS: "true"
  NPM_BUILD_CMD: build
```

```powershell
docker compose `
  -f docker-compose-non-dev.yml `
  -f docker-compose-prod-export.yml `
  build superset
```

构建完成后，本地镜像名为：

```text
superset-prod:latest
```

导出镜像包：

```powershell
docker save -o superset-prod.tar superset-prod:latest
```

如果需要压缩后传输：

```powershell
tar.exe -czf superset-prod.tar.gz superset-prod.tar
```

目标服务器加载镜像：

```bash
docker load -i superset-prod.tar
```

服务器部署用的 Compose 文件应使用已加载的镜像，而不是在服务器上重新 `build`：

```yaml
services:
  superset:
    image: superset-prod:latest
  superset-init:
    image: superset-prod:latest
  superset-worker:
    image: superset-prod:latest
  superset-worker-beat:
    image: superset-prod:latest
```

首次部署或包含数据库迁移时，在服务器执行初始化后再启动服务：

```bash
docker compose run --rm superset-init
docker compose up -d
```

### 设置中文界面

当前这套本地配置已经不再使用 `BABEL_DEFAULT_LOCALE`。要让中文在界面里可选并正常显示，需要在 `superset_config.py` 或 Docker 挂载的配置文件里启用 `SUPPORTED_LANGUAGES`，再通过 `SUPERSET_LANGUAGES` 控制实际开放的语言列表。

如果是本地源码启动，仓库根目录的 [superset_config.py](/D:/data/projects/superset/superset_config.py) 可按下面方式配置：

```python
import os

SUPPORTED_LANGUAGES = {
    "en": {"flag": "us", "name": "English"},
    "zh": {"flag": "cn", "name": "Chinese"},
}


def get_enabled_languages() -> dict[str, dict[str, str]]:
    language_codes = [
        code.strip()
        for code in os.getenv("SUPERSET_LANGUAGES", "en,zh").split(",")
        if code.strip()
    ]
    languages = {
        code: SUPPORTED_LANGUAGES[code]
        for code in language_codes
        if code in SUPPORTED_LANGUAGES
    }
    return languages or {"en": SUPPORTED_LANGUAGES["en"]}


LANGUAGES = get_enabled_languages()
```

然后启动本地后端时，确保 `SUPERSET_CONFIG_PATH` 指向这个文件，例如：

```powershell
$env:SUPERSET_CONFIG_PATH="D:\data\projects\superset\superset_config.py"
$env:SUPERSET_LANGUAGES="en,zh"
python -m flask run -p 8088 --reload --host 0.0.0.0
```

如果是 Docker 或服务器部署，可以继续在 `docker/.env-local` 中放环境变量，但它们只是给配置文件读取用的输入值：

```env
SUPERSET_LANGUAGES=en,zh
```

同时在挂载到容器的 `superset_config.py` 或 `superset_config_docker.py` 中读取这些变量：

```python
import os

SUPPORTED_LANGUAGES = {
    "en": {"flag": "us", "name": "English"},
    "zh": {"flag": "cn", "name": "Chinese"},
}

LANGUAGES = {
    code: SUPPORTED_LANGUAGES[code]
    for code in [item.strip() for item in os.getenv("SUPERSET_LANGUAGES", "en,zh").split(",")]
    if code in SUPPORTED_LANGUAGES
}
```

如果构建生产镜像包，还需要确保 `docker-compose-prod-export.yml` 的 build args 包含：

```yaml
BUILD_TRANSLATIONS: "true"
```

然后重新构建并导出：

```powershell
docker compose `
  -f docker-compose-non-dev.yml `
  -f docker-compose-prod-export.yml `
  build superset

docker save -o superset-prod.tar superset-prod:latest
```

`messages.json` 和 `messages.mo` 属于构建或编译阶段生成的本地产物，不需要提交到仓库。只有在你修改了 `messages.po` 翻译内容时，才需要在本地重新生成或编译它们。

已经登录过的浏览器会话可能仍保留旧语言。可访问语言切换地址，或清理浏览器 Cookie 后重新登录：

```text
http://服务器IP:8088/lang/zh
```

若中文仍不生效，优先检查这几项：

- `SUPERSET_CONFIG_PATH` 或容器挂载的配置文件是否真的被加载
- 配置文件里是否定义了 `SUPPORTED_LANGUAGES`，并正确导出了 `LANGUAGES`
- 生产镜像构建时是否设置了 `BUILD_TRANSLATIONS=true`
- 浏览器当前会话是否还缓存着旧语言

## 前端 Docker、后端本机

本模式下后端监听宿主机 `8088`，前端开发服务器监听宿主机 `9000`。
浏览器应访问 `http://localhost:9000`；不要把 `9000` 当作后端 API 端口。

覆盖文件 `docker-compose.backend-local.yml` 会：

- 将 `superset-node` 的后端地址指向 `http://host.docker.internal:8088`。
- 将 Docker 中的 `superset`、`superset-init`、`superset-worker` 与 `superset-worker-beat` 放入 `backend-in-docker` profile，默认不会启动。

### 启动前端容器

```powershell
docker compose -f docker-compose.yml -f docker-compose.backend-local.yml up -d superset-node

# 查看前端启动日志
 docker compose -f docker-compose.yml -f docker-compose.backend-local.yml logs -f superset-node
```

前端开发服务器地址：`http://localhost:9000`。

这里使用宿主机 `9000` 映射容器内 Webpack 的 `9000`。前端 API 请求会代理到宿主机后端的 `8088`，对应覆盖文件中的 `http://host.docker.internal:8088`。

### 启动本机后端

激活虚拟环境后设置环境变量。以下示例使用 Docker 中的 Postgres 与 Redis：

```powershell
.\.venv\Scripts\Activate.ps1
$env:FLASK_APP="superset.app:create_app()"
$env:FLASK_DEBUG="1"
$env:SUPERSET_CONFIG_PATH="D:\data\projects\superset\docker\pythonpath_dev\superset_config.py"
$env:SUPERSET_SECRET_KEY="replace_with_a_fixed_local_secret"
$env:SUPERSET__SQLALCHEMY_DATABASE_URI="postgresql+psycopg2://superset:superset@127.0.0.1:5432/superset"
$env:REDIS_HOST="127.0.0.1"
$env:REDIS_PORT="6379"
$env:REDIS_CELERY_DB="0"
$env:REDIS_RESULTS_DB="1"
```

首次运行或元数据库有迁移时：

```powershell
superset db upgrade
superset fab create-admin --username admin --firstname Superset --lastname Admin --email admin@superset.com --password admin
superset init
```

启动本机后端：

```powershell
python -m flask run -p 8088 --reload --host 0.0.0.0
```

也可直接调用 Superset CLI：

```powershell
.\.venv\Scripts\superset.exe run -p 8088 --with-threads --reload --debugger --debug
```

若元数据库 URI 使用 `mysql://...`，请在本机虚拟环境安装驱动：

```powershell
.\.venv\Scripts\python.exe -m pip install mysqlclient
```

注意：本机后端必须监听 `0.0.0.0:8088`，使 Docker 容器可以通过 `host.docker.internal:8088` 访问。使用 Docker 中的 Postgres 与 Redis 时，需保持 `db` 和 `redis` 服务运行。

切回“后端也在 Docker 中”模式：

```powershell
docker compose -f docker-compose.yml -f docker-compose.backend-local.yml --profile backend-in-docker up -d
```

### PyCharm 配置

新建 PyCharm 的 `Python` Run/Debug Configuration：

| 字段 | 值 |
| --- | --- |
| Python interpreter | `D:\data\projects\superset\.venv\Scripts\python.exe` |
| Run mode | `Module name` |
| Module name | `flask` |
| Parameters | `run -p 8088 --reload --host 0.0.0.0` |
| Working directory | 项目根目录 |

将上一节的环境变量加入该运行配置，至少包含 `FLASK_APP`、`SUPERSET_CONFIG_PATH`、`SUPERSET_SECRET_KEY`、`SUPERSET__SQLALCHEMY_DATABASE_URI` 和 Redis 配置。

### 筛选列搜索无响应

如果 Explore 中能打开页面，但筛选列搜索没有反应，请按顺序检查：

1. 浏览器访问的是 `http://localhost:9000`，而不是直接访问 `8088`。
2. 本机后端确实监听 `0.0.0.0:8088`，并可访问 `http://localhost:8088/health`。
3. 浏览器 Network 中搜索时应出现 `/api/v1/datasource/table/<id>/column/<column>/values/` 请求。
4. 如果没有该请求，通常是加载了旧的前端 bundle；重启 `superset-node` 并强制刷新浏览器。
5. 如果请求返回 `401/403/404/500`，分别检查登录状态、权限、前后端版本和后端日志。

不要将 `superset` 设为 `Module name`。这会执行 `python -m superset`，但该包没有 `__main__.py`，会报错：

```text
No module named superset.__main__; 'superset' is a package and cannot be directly executed
```

## Windows 依赖：python-ldap

Superset 的 `development` 依赖需要 `python-ldap>=3.4.7`。PyPI 未提供适用于 CPython 3.11 x64 的 Windows wheel，`pip` 会尝试从源码编译。出现以下错误说明编译环境缺少 OpenLDAP 开发头文件：

```text
fatal error C1083: 无法打开包括文件: “lber.h”: No such file or directory
```

`D:\app\OpenLDAP-2.6.9` 只含 OpenLDAP 运行时和服务端文件，不含 `include\lber.h`、`include\ldap.h` 与编译所需 `.lib` 文件，不能直接用于编译 `python-ldap`。

本机使用第三方非官方 Windows wheel：公开仓库 [lv5kakita/python-ldap-build](https://github.com/lv5kakita/python-ldap-build) 的 [GitHub Actions run 28920160802](https://github.com/lv5kakita/python-ldap-build/actions/runs/28920160802) AMD64 artifact。该 job 的构建与 `import ldap` 测试成功；整个 workflow 失败源自无关 ARM64 job。

下载 AMD64 artifact：

```powershell
$artifactDir = Join-Path $env:TEMP "python-ldap-3.4.7-wheels"
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
$artifactZip = Join-Path $artifactDir "wheels-win-amd64.zip"

curl.exe -fL `
  "https://nightly.link/lv5kakita/python-ldap-build/actions/runs/28920160802/wheels-win-amd64.zip" `
  -o $artifactZip

tar.exe -xf $artifactZip -C $artifactDir
```

安装前校验 CPython 3.11 x64 wheel。已验证 SHA-256：`411CACAC657771C12F37B05639EA59BE6ED0614D7ED41F94C33B5F5A7CE1896B`。

```powershell
$wheel = Join-Path $artifactDir "python_ldap-3.4.7-cp311-cp311-win_amd64.whl"
Get-FileHash -Algorithm SHA256 $wheel

# 如果 python为3.12
$wheel = Join-Path $artifactDir "python_ldap-3.4.7-cp312-cp312-win_amd64.whl"
```

校验值匹配后，安装并验证：

```powershell
.\.venv\Scripts\python.exe -m pip install --no-deps $wheel
# 执行完这一步，再执行：pip install -r .\requirements\development.txt
.\.venv\Scripts\python.exe -c "import ldap, _ldap; print(ldap.__version__); print(_ldap.__file__); print(ldap.get_option(ldap.OPT_API_INFO))"
.\.venv\Scripts\python.exe -m pip show python-ldap
.\.venv\Scripts\python.exe -m pip check
```

预期 `ldap.__version__` 为 `3.4.7`，`_ldap` 位于 `.venv\Lib\site-packages\_ldap.cp311-win_amd64.pyd`，并且 `pip check` 输出 `No broken requirements found.`。

## 常见问题

### SECRET_KEY 与已有元数据

元数据库初始化后，`SUPERSET_SECRET_KEY` 必须保持稳定。Superset 使用该值加密元数据库中的数据库连接信息。

如果启动时出现：

```text
ValueError: The length of the provided data is not a multiple of the block length.
```

通常表示 Superset 正在使用错误的 key 解密已有元数据，或元数据库中的加密字段已经损坏。

全新测试部署可以重建元数据库：

```sql
DROP DATABASE superset;
CREATE DATABASE superset DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON superset.* TO 'superset'@'%';
FLUSH PRIVILEGES;
```

已有部署必须继续使用原来的 `SUPERSET_SECRET_KEY`。若需更换 key，按 Superset 密钥轮换流程，将旧 key 配置为 `PREVIOUS_SECRET_KEY`。

## 部署到其他服务器

可选择推送镜像到镜像仓库，或导出为 tar 包传输。服务器只需要加载生产镜像并使用不含 `build:` 的 Compose 文件启动，不需要完整源码。

推送到镜像仓库：

```powershell
docker compose `
  -f docker-compose-non-dev.yml `
  -f docker-compose-prod-export.yml `
  build superset
docker tag superset-prod:latest your-registry/superset:custom
docker push your-registry/superset:custom
```

导出 tar 包：

```powershell
docker save -o superset-prod.tar superset-prod:latest
```

目标服务器加载并启动：

```bash
docker load -i superset-prod.tar
```

服务器目录示例：

```text
/opt/superset/
├── docker/
│   ├── .env
│   ├── .env-local
│   ├── pythonpath_dev/
│   │   └── superset_config.py
│   └── requirements-local.txt
├── docker-compose.server.yml
└── superset-prod.tar
```

`superset-prod:latest` 连接 MySQL 且使用 `mysql` 方言时，镜像内必须具备编译 `mysqlclient` 的系统依赖。本仓库 `Dockerfile` 的 `lean` target 已安装 `build-essential`、`pkg-config` 和 `default-libmysqlclient-dev`，服务器目录中的 `docker/requirements-local.txt` 应保持：

```text
mysqlclient==2.2.8
```

如果服务器仍报 `pkg-config: not found`，说明运行的不是按当前 `Dockerfile` 重新构建的镜像，需要重新构建并导出 `superset-prod:latest`。

服务器启动文件 `docker-compose.server.yml` 示例：

```yaml
x-superset-volumes: &superset-volumes
  - ./docker/pythonpath_dev:/app/pythonpath
  - ./docker/requirements-local.txt:/app/docker/requirements-local.txt:ro
  - superset_home:/app/superset_home

services:
  redis:
    image: redis:7
    container_name: superset_cache
    restart: unless-stopped
    volumes:
      - redis:/data

  superset-init:
    image: superset-prod:latest
    container_name: superset_init
    command: ["/app/docker/docker-init.sh"]
    user: "root"
    env_file:
      - docker/.env
      - docker/.env-local
    depends_on:
      - redis
    volumes: *superset-volumes
    healthcheck:
      disable: true

  superset:
    image: superset-prod:latest
    container_name: superset_app
    command: ["/app/docker/docker-bootstrap.sh", "app-gunicorn"]
    user: "root"
    restart: unless-stopped
    ports:
      - "8088:8088"
    env_file:
      - docker/.env
      - docker/.env-local
    depends_on:
      superset-init:
        condition: service_completed_successfully
    volumes: *superset-volumes

  superset-worker:
    image: superset-prod:latest
    container_name: superset_worker
    command: ["/app/docker/docker-bootstrap.sh", "worker"]
    user: "root"
    restart: unless-stopped
    env_file:
      - docker/.env
      - docker/.env-local
    depends_on:
      superset-init:
        condition: service_completed_successfully
    volumes: *superset-volumes

  superset-worker-beat:
    image: superset-prod:latest
    container_name: superset_worker_beat
    command: ["/app/docker/docker-bootstrap.sh", "beat"]
    user: "root"
    restart: unless-stopped
    env_file:
      - docker/.env
      - docker/.env-local
    depends_on:
      superset-init:
        condition: service_completed_successfully
    volumes: *superset-volumes
    healthcheck:
      disable: true

volumes:
  superset_home:
  redis:
```

不要挂载整个 `./docker:/app/docker`。生产镜像内已经有 `/app/docker/docker-init.sh` 和 `/app/docker/docker-bootstrap.sh`，整目录挂载会覆盖镜像内脚本并导致：

```text
exec: "/app/docker/docker-init.sh": stat /app/docker/docker-init.sh: no such file or directory
```

在目标服务器通过 `docker/.env-local` 配置：

```env
SUPERSET_SECRET_KEY=replace_with_the_same_fixed_secret
SUPERSET_LOAD_EXAMPLES=no

SUPERSET_PORT=8088
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_CELERY_DB=0
REDIS_RESULTS_DB=1

DATABASE_DIALECT=mysql
DATABASE_HOST=172.30.0.1
DATABASE_PORT=3306
DATABASE_DB=superset
DATABASE_USER=superset
DATABASE_PASSWORD=password

EXAMPLES_HOST=172.30.0.1
EXAMPLES_PORT=3306
EXAMPLES_DB=superset
EXAMPLES_USER=superset
EXAMPLES_PASSWORD=password
```

Linux 容器内的 `127.0.0.1` 是容器自身，不是宿主机。若 MySQL 与 Superset 部署在同一台服务器，容器访问宿主机 MySQL 应使用 Docker 网关地址，例如固定为 `172.30.0.1`。

为避免每次 `docker-compose down` 后 Docker 重新分配网关，在 `docker-compose.server.yml` 末尾固定默认网络：

```yaml
networks:
  default:
    ipam:
      config:
        - subnet: 172.30.0.0/16
          gateway: 172.30.0.1
```

宿主机 MySQL 必须监听非 localhost 地址：

```bash
ss -lntp | grep 3306
```

若只看到 `127.0.0.1:3306`，需要在 MySQL 配置的 `[mysqld]` 下设置：

```ini
bind-address = 0.0.0.0
```

然后重启 MySQL。

MySQL 授权示例：

```sql
CREATE USER IF NOT EXISTS 'superset'@'172.30.%' IDENTIFIED BY 'password';
ALTER USER 'superset'@'172.30.%' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON superset.* TO 'superset'@'172.30.%';
FLUSH PRIVILEGES;
```

如果服务器开启 firewalld，需要放行 Docker 固定网段访问宿主机 3306：

```bash
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="172.30.0.0/16" port protocol="tcp" port="3306" accept'
firewall-cmd --reload
```

常见错误与含义：

| 错误 | 原因 | 处理 |
| --- | --- | --- |
| `No module named 'MySQLdb'` | 使用了 `DATABASE_DIALECT=mysql`，但镜像没有 `mysqlclient` | 使用包含 `mysqlclient` 的镜像，或在带 `pkg-config`、`default-libmysqlclient-dev` 的构建阶段安装 `mysqlclient` 后重新构建 |
| `pkg-config: not found` / `Can not find valid pkg-config name` | 运行的镜像没有按当前 `Dockerfile` 构建，缺少 `pkg-config`、`default-libmysqlclient-dev` | 重新构建并部署包含 MySQL 系统依赖的镜像 |
| `error: command 'gcc' failed: No such file or directory` | 运行的镜像缺少 C 编译工具链，无法源码编译 `mysqlclient` | 重新构建并部署包含 `build-essential` 的镜像 |
| `Name or service not known: host.docker.internal` | Linux 服务器默认没有 Docker Desktop 的宿主机别名 | 使用 Docker 网关 IP，或在 Compose 中显式配置 `host-gateway` |
| `No route to host` | 防火墙或宿主机网络拒绝 Docker 网段访问 3306 | 放行 `172.30.0.0/16` 到 3306，并确认 MySQL 监听 `0.0.0.0` |

启动与查看日志：

```bash
docker-compose -f docker-compose.server.yml down
docker-compose -f docker-compose.server.yml up -d
docker-compose -f docker-compose.server.yml logs -f superset-init
docker-compose -f docker-compose.server.yml logs -f superset
curl http://localhost:8088/health
```

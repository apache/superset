---
title: 把 Fork 后的 Superset 部署到远程云服务器（中文）
sidebar_position: 4
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# 把 Fork 后的 Superset 部署到远程云服务器

本文档面向**生产 / 准生产**场景，给出一套把本仓库（apache/superset 的 fork，~6.1）以「**构建机出 wheel → 远程云服务器 `pip install wheel`**」的方式部署上线的完整步骤。这是 Apache Superset 官方 PyPI 安装方式（`pip install apache-superset`）应用到自有 fork 时的**完整等价做法**——你自己当一回 release manager，给自己的 fork 打一份 wheel。

开发与调试场景请看 [development-setup.zh.md](development-setup.zh.md)；英文官方 PyPI 指南见 [Installing from PyPI](https://superset.apache.org/docs/installation/pypi)。

## 一、整体思路

> **核心**：把"前端 npm build + Python 打包"这两个**只需要做一次**的事放在**构建机**上完成，得到一个 `.whl` 文件；**远程云服务器**仅需要 Python，`pip install` 这个 wheel 就装好了——零 Node、零 npm、零源码污染。

```mermaid
flowchart LR
    subgraph build [构建机]
        b1[fork 源码 git clone] --> b2["npm ci + npm run build<br/>(出 superset/static/assets)"]
        b2 --> b3["python -m build --wheel<br/>(打 wheel)"]
        b3 --> b4["dist/apache_superset-*.whl<br/>~50 MB"]
    end

    subgraph cloud [远程云服务器]
        c0["仅装 Python 与系统编译依赖<br/>无 Node、无 git、无源码"]
        c0 --> c1["python -m venv venv"]
        c1 --> c2["pip install xxx.whl<br/>+ mysqlclient + gunicorn + gevent"]
        c2 --> c3["写 superset_config.py"]
        c3 --> c4["superset db upgrade && init"]
        c4 --> c5[systemd 启动 gunicorn]
    end

    b4 -- "scp 一个文件" --> c2
```

| 维度 | 单机一体方案<br/>（构建机 = 生产机） | **本文主流程<br/>（构建机 + 远程云）** |
|---|---|---|
| 生产机依赖 | Python + Node + npm + git + 源码 | **仅 Python + 系统库** |
| 单机磁盘占用 | ~5 GB（含 node_modules 中间产物） | **~1.5 GB**（仅 venv） |
| 多机部署 | 每台机器重跑 npm build（15 min × N） | **一次 build，scp 到 N 台机器** |
| 适合内网/防火墙 | 差（每台机器要联 npmjs） | **完美**（云机只要联 PyPI） |
| 与 `pip install apache-superset` 体验 | 不像 | **几乎等价**——你成了自己 fork 的发布者 |
| 升级流程 | 云上 git pull + build + reinstall | **本地出新 wheel → scp → reinstall** |

> 单机一体方案（不区分构建机 / 生产机）请看 [附录 A](#附录-a单机一体方案构建机即生产机)。

### 运行时拓扑

```mermaid
flowchart LR
    client[浏览器] -->|"HTTP/HTTPS<br/>8088 或 nginx 443"| nginx[可选: nginx 反代<br/>HTTPS 终结/静态加速]
    nginx --> gunicorn
    client -.直连.-> gunicorn

    subgraph cloud [云服务器]
        subgraph deploy ["/opt/superset"]
            venv["venv<br/>装好的 superset 包"]
            cfg[superset_config.py]
        end
        gunicorn["gunicorn -k gevent<br/>0.0.0.0:8088"]
        sysd[systemd unit]
        celery["可选: celery worker/beat"]
    end

    venv --> gunicorn
    cfg --> gunicorn
    sysd --> gunicorn
    sysd --> celery
    gunicorn -->|TCP| db[(MySQL 8 / Postgres 13+)]
    gunicorn -->|TCP| redis[(Redis 6+)]
    celery -->|TCP| db
    celery -->|TCP| redis
```

---

## 二、前置条件

### 2.1 构建机

任何能跑 Node 22 + Python 3.10 的 Linux 都行——本地虚拟机、自己开发用的 Ubuntu / WSL2、一台 CI runner 都可以。**不必和生产机同物理位置**。

| 项 | 要求 | 说明 |
|---|---|---|
| OS | Ubuntu 22.04 / 24.04（与生产机同发行版） | 保持 glibc 版本一致最稳 |
| 架构 | 与云服务器同架构（一般都 `x86_64`） | wheel 是纯 Python 的 `any` 平台，但本地编译的扩展（mysqlclient 等装在云上）受架构影响 |
| 磁盘 | ≥ 10 GB | node_modules 3 GB + 源码 200 MB + dist 50 MB |
| 内存 | ≥ 4 GB | npm build 峰值 2.5 GB |
| 网络 | 能访问 `github.com`、`registry.npmjs.org`、`pypi.org` | |

> 推荐就用你本地开发用的 Linux VM（Windows VirtualBox + Ubuntu 22 / WSL2 都行）。Windows 原生**不推荐**做构建机：webpack 插件路径分隔符、symlink 权限、IO 慢，坑较多。

### 2.2 远程云服务器

| 项 | 要求 | 验证 |
|---|---|---|
| OS | **Ubuntu 22.04 LTS**（本文示例）/ 24.04 LTS / Debian 12 / CentOS Stream 9 | `cat /etc/os-release` |
| 架构 | 与构建机一致 | `uname -m` |
| 磁盘 | 系统盘空闲 ≥ 3 GB（venv + 配置 + 日志） | `df -h /opt` |
| 内存 | ≥ 2 GB（无大数据集时） / ≥ 4 GB（推荐） | `free -h` |
| 端口 | 8088（应用）/ 80 / 443（nginx，可选） | `ss -ltnp` |
| sudo 权限 | 当前用户能 sudo | `sudo -n whoami` |
| 网络 | 能访问 PyPI、能连到元数据库与 Redis | `curl -I https://pypi.org` |

### 2.3 元数据库（二选一）

| 数据库 | 版本 | 字符集 |
|---|---|---|
| **MySQL** | 8.0+ | `utf8mb4` / `utf8mb4_unicode_ci` |
| **PostgreSQL** | 13+ | `UTF8` |

可以是：

- 云厂商托管服务（阿里云 RDS、腾讯云 CDB、AWS RDS、GCP Cloud SQL）——**强烈推荐**
- 与 Superset 同机自建（docker 或 apt 装）
- 独立 IDC 自建集群

只需 superset 进程能 TCP 直连。

### 2.4 Redis

云厂商托管（阿里云 Tair、AWS ElastiCache）或自建 6+ / 7+ 均可，TCP 直连。

### 2.5 部署用户

云服务器上建议**专用账号**：

```bash
sudo useradd -m -s /bin/bash superset
sudo passwd superset                 # 设密码或后续用 ssh key
# 装依赖期间临时给 sudo
sudo usermod -aG sudo superset
```

部署完成后建议把 `superset` 移出 `sudo` 组。

---

## 三、构建机：装工具链（一次性）

以下命令在**构建机**上执行。

### 3.1 系统编译依赖

```bash
sudo apt-get update
sudo apt-get install -y \
    build-essential libssl-dev libffi-dev \
    pkg-config \
    python3.10-dev python3.10-venv python3-pip \
    git curl ca-certificates
```

> 注意：构建机**不需要** `default-libmysqlclient-dev` / `libpq-dev` 这些数据库 client 头文件——它们只在云服务器上装 `mysqlclient` / `psycopg2` 时才需要。

### 3.2 Node 22 + npm 10（前端 build 要求）

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"

nvm install 22
nvm alias default 22
node -v   # v22.22.x
npm -v    # 10.9.x
```

> 项目 [superset-frontend/package.json](../../../superset-frontend/package.json) 的 `engines` 强制要求 Node `^22.22.0` 与 npm `^10.8.1`，低于此版本 build 会报错。

---

## 四、构建机：克隆 Fork + Build 前端 + 出 wheel

> **本节的最终产物**是一个 `.whl` 文件（约 50 MB），下面所有后续步骤都围绕它展开。

### 4.1 拉代码

```bash
sudo mkdir -p /opt/superset-build
sudo chown -R $USER:$USER /opt/superset-build
cd /opt
git clone --depth=1 --branch=master \
    https://github.com/250715122/superset.git /opt/superset-build

cd /opt/superset-build
git log --oneline -1
```

> 构建机上的目录用 `/opt/superset-build`，与云端 `/opt/superset` 区分。

### 4.2 构建前端静态产物

```bash
cd /opt/superset-build/superset-frontend
nvm use 22

npm ci --no-audit --no-fund                                  # 约 5-10 分钟
NODE_OPTIONS="--max-old-space-size=4096" npm run build       # 约 8-15 分钟

# 验证
ls -lh ../superset/static/assets/manifest.json
du -sh ../superset/static/assets/                            # 期望 200-400 MB
```

> 这一步在 `superset/static/assets/` 下生成压缩后的 JS/CSS/字体/图片——它们将随后一步打进 wheel。

### 4.3 创建构建用 venv

构建用的 venv 独立于运行用的 venv，**只装打包工具**，不需要 superset 的运行时依赖：

```bash
cd /opt/superset-build
python3.10 -m venv build-venv
source build-venv/bin/activate

pip install --upgrade 'pip==25.2' 'setuptools<75' wheel build
```

> pip 26.x 当前有 certifi 路径 bug，固定到 25.2。

### 4.4 打 wheel（**两个**：主包 + superset-core 子包）

> ⚠️ Superset 6.1 是 **monorepo**——除了主包 `apache-superset` 之外，仓库根 `superset-core/` 是**独立的第二个 PyPI 包** `apache-superset-core`，其中包含主代码 `import` 用到的 `superset_core.semantic_layers`、`superset_core.extensions` 等模块。
>
> **必须把这两个包都打 wheel**，否则云端 pip 会从 PyPI 拉到旧的 `apache-superset-core 0.1.0`（缺 `semantic_layers` 子模块），启动时报：
>
> ```
> ModuleNotFoundError: No module named 'superset_core.semantic_layers'
> ```

```bash
cd /opt/superset-build

# 4.4.1 主包 wheel
python -m build --wheel

# 4.4.2 superset-core 子包 wheel（输出到同一个 dist/）
python -m build --wheel --outdir dist ./superset-core

ls -lh dist/
# 输出形如:
# -rw-rw-r-- 1 user user  97M  apache_superset-6.1.0.dev0-py3-none-any.whl
# -rw-rw-r-- 1 user user  60K  apache_superset_core-0.1.0-py3-none-any.whl
```

主 wheel 打包做的事（不需要细究，记结论即可）：

1. 读 [pyproject.toml](../../../pyproject.toml) 的 `[build-system]`，知道用 setuptools 构建
2. 读 [setup.py](../../../setup.py) 拿到包名 `apache_superset`、版本、依赖、entry_points
3. 读 [MANIFEST.in](../../../MANIFEST.in)，把 `superset/static/`、`superset/templates/`、`superset/migrations/` 这些非 `.py` 资源一并塞进去
4. 把所有内容压缩成 `apache_superset-X.Y.Z-py3-none-any.whl`

`superset-core` 子包做的事：

1. 读 [superset-core/pyproject.toml](../../../superset-core/pyproject.toml) 拿到包名 `apache-superset-core`、依赖
2. 把 `superset-core/src/superset_core/` 全部打成 `apache_superset_core-0.1.0-py3-none-any.whl`

### 4.5 验证 wheel 内容

```bash
# 主 wheel：前端 build 产物
unzip -l dist/apache_superset-*.whl | grep "static/assets/manifest.json"
# 应输出 manifest.json 一行 → 说明前端产物已经打进 wheel

# 主 wheel 依赖列表
unzip -p dist/apache_superset-*.whl '*/METADATA' | head -50

# superset-core wheel：semantic_layers 必须包含
unzip -l dist/apache_superset_core-*.whl | grep semantic_layers
# 应输出多行 .py 文件 (layer.py / models.py / view.py 等)
```

> **如果主 wheel 没看到 `static/assets/manifest.json`**，说明 4.2 步前端 build 没生效，回去重跑。
>
> **如果 superset-core wheel 没看到 `semantic_layers/`**，回去看 `superset-core/src/superset_core/` 子目录是否完整。

### 4.6 记录构建 commit

```bash
cd /opt/superset-build
git rev-parse HEAD > dist/BUILD_COMMIT.txt
cat dist/BUILD_COMMIT.txt        # 部署后用于核对哪个版本上线了
```

---

## 五、传输到云服务器

把 4.4 出的**两个 wheel** + 版本约束文件 + build commit 一起传过去。

```bash
# 1. 两个 wheel（主包 + superset-core 子包）
scp /opt/superset-build/dist/apache_superset-*.whl \
    /opt/superset-build/dist/apache_superset_core-*.whl \
    <user>@<cloud-host>:/tmp/

# 2. build commit 记录
scp /opt/superset-build/dist/BUILD_COMMIT.txt <user>@<cloud-host>:/tmp/

# 3. ⚠️ 版本约束文件（关键！否则云端 pip 会拉到 Superset 没测过的依赖版本）
scp /opt/superset-build/requirements/base.txt \
    <user>@<cloud-host>:/tmp/superset-base-constraints.txt

# 4.（可选，首次部署时）准备好的 superset_config.py 模板
scp /path/to/your/superset_config.py <user>@<cloud-host>:/tmp/
```

> **为什么必须传 `requirements/base.txt`？**
>
> wheel 内部的依赖声明（来自 `pyproject.toml` 的 `dependencies`）是**松散的版本区间**，例如：
>
> ```
> numpy>1.23.5, <2.3
> ```
>
> 这只表示"理论上兼容"。Superset 官方真正**测试通过**的精确版本记录在 `requirements/base.txt`：
>
> ```
> numpy==1.26.4
> gunicorn==23.0.0
> pandas==2.1.4
> ...
> ```
>
> 不带约束直接 `pip install xxx.whl`，pip 会按松散区间拉到当下允许范围内的最新版（例如 numpy 2.2.x），但 Superset 6.1 的源码仍在用 `np.product`（已在 numpy 2.0 被移除），导致 `superset version` 启动即崩。第七节会用 `-c` 把所有依赖锁回 `base.txt` 的版本。

> **多台云机器**：把 scp 改成循环（注意 `dist/*.whl` 会自动包含两个 wheel）：
>
> ```bash
> for host in prod1 prod2 prod3; do
>     scp /opt/superset-build/dist/*.whl                   ${host}:/tmp/
>     scp /opt/superset-build/requirements/base.txt        ${host}:/tmp/superset-base-constraints.txt
> done
> ```

> **跨网络分发**：若构建机和云机不在同一内网，可改成上传到 OSS / S3 / 私有 PyPI 后再 wget 拉。约束文件 (`base.txt`) 也要一起放上去。

---

## 六、云服务器：装系统依赖（每台云机一次性）

以下命令在**云服务器**上执行。**没有 Node、没有 npm、没有 git**。

```bash
ssh <user>@<cloud-host>

sudo apt-get update
sudo apt-get install -y \
    build-essential libssl-dev libffi-dev \
    libsasl2-dev libldap2-dev \
    default-libmysqlclient-dev pkg-config \
    libpq-dev \
    python3.10-dev python3.10-venv python3-pip \
    curl ca-certificates
```

> - `default-libmysqlclient-dev` —— 装 MySQL 驱动时编译需要
> - `libpq-dev` —— 装 PostgreSQL 驱动时编译需要
> - `libsasl2-dev libldap2-dev` —— Superset 启动时会 import LDAP（即使你不用）
> - 这一节装完后，云机器上**不需要再 apt 装任何东西**，再也不会用 `apt`

---

## 七、云服务器：venv + pip install wheel

```bash
sudo mkdir -p /opt/superset
sudo chown -R superset:superset /opt/superset

sudo -iu superset
cd /opt/superset

# 创建运行用 venv
python3.10 -m venv venv
source venv/bin/activate

# 固定 pip 25.2 防 26.x certifi bug
pip install --upgrade 'pip==25.2' wheel setuptools
```

### 7.1 装 wheel 本体（**主包 + superset-core 都要装，务必用 `-c` 约束文件**）

```bash
# 1. 主包 wheel（约 5-10 分钟，pip 会从 PyPI 拉 ~200 个运行时依赖）
pip install /tmp/apache_superset-*.whl \
    -c /tmp/superset-base-constraints.txt

# 2. superset-core 子包 wheel（覆盖 PyPI 上的旧版 0.1.0）
#    --force-reinstall：主包安装时 pip 已经从 PyPI 拉过 apache-superset-core 0.1.0，
#                       这里必须用本地 wheel 强制顶掉它，否则 semantic_layers 子模块缺失
#    --no-deps：本地 wheel 跟 PyPI 上是同一个 version=0.1.0，不重复解析依赖
pip install /tmp/apache_superset_core-*.whl --force-reinstall --no-deps
```

> **为什么 superset-core 要单独装一遍？**
>
> 因为 [superset-core/pyproject.toml:21](../../../superset-core/pyproject.toml) 中 `version = "0.1.0"` 跟 PyPI 上的发布版一样，但**仓库里的源码比 PyPI 上的内容更全**（含 `semantic_layers/`、`extensions/` 等子模块）。
>
> 第 1 步 `pip install` 主 wheel 时，pip 看依赖里有 `apache-superset-core>=0.1.0`，会直接去 **PyPI 拉到老版 0.1.0**（缺 `semantic_layers/`），导致启动报 `ModuleNotFoundError: No module named 'superset_core.semantic_layers'`。
>
> 第 2 步 `--force-reinstall` 强制把本地构建好的"全量版" 0.1.0 wheel 顶上去，问题就解决了。

> **不要省略 `-c`**：wheel 内嵌的依赖区间是松散的（例如 `numpy>1.23.5, <2.3`），不加约束时 pip 会拉到 numpy 2.x，触发已知崩溃：
>
> ```
> AttributeError: module 'numpy' has no attribute 'product'
> ```
>
> 已经踩过坑的同学：先 `pip install 'numpy==1.26.4' 'gunicorn==23.0.0' 'gevent==24.2.1' --force-reinstall` 强制对齐，再继续后面的步骤；最稳妥的是按下面 7.5 节整体重装一遍。

### 7.2 装数据库驱动 + 生产 WSGI + 上游漏声明的依赖

#### 7.2.1 数据库驱动（按你 `superset_config.py` 里 `SQLALCHEMY_DATABASE_URI` 的协议来选）

| URI 协议 | 需要装的 pip 包 | 说明 |
|---|---|---|
| `mysql+mysqldb://` | `mysqlclient` | C 扩展，性能更好，依赖 `default-libmysqlclient-dev` 编译 |
| `mysql+pymysql://` | `PyMySQL` | 纯 Python，安装简单无需编译 |
| `postgresql+psycopg2://` | `psycopg2-binary` 或 `psycopg2` | PostgreSQL |

```bash
# 选其中一行执行：

# MySQL + mysqlclient（推荐，需要 default-libmysqlclient-dev 系统包）
pip install 'mysqlclient>=2.2.0' -c /tmp/superset-base-constraints.txt

# MySQL + PyMySQL（无需编译，启动稍慢但部署简单）
# pip install 'PyMySQL>=1.1.0' -c /tmp/superset-base-constraints.txt

# PostgreSQL
# pip install 'psycopg2-binary>=2.9.9' -c /tmp/superset-base-constraints.txt
```

> **常见误区**：用 `mysql+pymysql://` 但只装了 `mysqlclient`（或反过来），启动时报 `No module named 'pymysql'` 或 `No module named 'MySQLdb'`。两个驱动**不能互换**，必须按 URI 协议来选。

#### 7.2.2 生产 WSGI

```bash
# gunicorn / gevent 已在 base.txt 中精确锁定，-c 会把它们装到 23.0.0 / 24.x
pip install 'gunicorn>=22.0.0' 'gevent>=24.2.1' -c /tmp/superset-base-constraints.txt
```

#### 7.2.3 上游漏声明的运行时依赖

Superset 6.1 主代码 `import` 了一些库，但 [pyproject.toml](../../../pyproject.toml) 里**没有声明**它们，pip install wheel 时不会自动拉。**必须手动装**，否则访问 `/login/` 这类页面会因 `db_engine_specs/aws_iam.py` import 失败而返回 500：

```bash
pip install cachetools -c /tmp/superset-base-constraints.txt
```

> 这是 apache 上游 6.1 的隐藏 bug（详见 [Q14](#q14-页面-500-报-no-module-named-cachetools)），将来在 fork 里把 `cachetools` 补进 `pyproject.toml` 后这一步可以省。

#### 7.2.4 业务数据库的 SQLAlchemy 方言包（连什么库就装什么方言）

7.2.1 的"元数据库驱动"和这一节的"业务数据库方言"是**两件不同的事**：

- 元数据库（superset 自己的库，存 dashboard / chart 元数据）→ 7.2.1 装的就是
- 业务数据库（你要在 superset 里建 Database 连接来查询的目标库，例如 StarRocks / Clickhouse / Trino）→ **这一节**

每种业务数据库都要单独 `pip install` 它的 SQLAlchemy 方言包，否则在 superset UI 里建数据库连接、或者已有 dashboard 加载时，会报：

```
DB engine Error
Can't load plugin: sqlalchemy.dialects:<dialect-name>
```

**常见业务数据库速查表**（按需挑装）：

| 业务数据库 | URI 前缀 | pip 包 | 备注 |
|---|---|---|---|
| StarRocks | `starrocks://` | `starrocks` | 内部用 pymysql 作 DBAPI，需先装 PyMySQL |
| Clickhouse | `clickhousedb://` | `clickhouse-connect` | |
| Apache Doris | `doris://` | `pydoris` | 同样基于 pymysql |
| Apache Hive | `hive://` | `pyhive[hive]`、`thrift` | |
| Presto / Trino | `trino://` | `trino` | |
| Apache Druid | `druid://` | `pydruid` | |
| Snowflake | `snowflake://` | `snowflake-sqlalchemy` | |
| BigQuery | `bigquery://` | `sqlalchemy-bigquery` | |
| Databricks | `databricks://` | `databricks-sqlalchemy` | |
| Oracle | `oracle://` | `cx_Oracle` 或 `oracledb` | |
| MS SQL Server | `mssql+pyodbc://` | `pyodbc` + 系统装 ODBC driver | |
| MongoDB(BI) | `mongodb://` | `pymongo` | |

完整列表见 [Connecting to Databases | Apache Superset](https://superset.apache.org/docs/configuration/databases)。

**示例：StarRocks**

```bash
source /opt/superset/venv/bin/activate

pip install 'starrocks==1.3.3' -c /opt/superset/base-constraints.txt
```

> StarRocks 方言会**间接拉一些依赖**（alembic、asyncmy2、greenlet 等），这些会被 `-c base-constraints.txt` 拉到 Superset 测试过的版本，不会破坏现有依赖。

> ⚠️ **Superset 6.1 起 StarRocks 连接 URI 必须用 `catalog.db` 两段式**（6.0.1 时代单段 `/db` 写法不再可用）。内置默认 catalog 叫 `default_catalog`，所以原本写 `starrocks://.../bluetti` 的连接，6.1 上要写成 `starrocks://.../default_catalog.bluetti`。详见 [Q17](#q17-starrocks-报-5078-unknown-catalog-xxx但用-mysql-client-直连能通)。

装完**必须 `sudo systemctl restart superset` 让 worker 重新加载**，否则即使 venv 里有方言包，已经跑起来的 Python 进程也不会感知到新模块。

验证方言注册成功（不连真实库）：

```bash
source /opt/superset/venv/bin/activate
python - <<'EOF'
from sqlalchemy import create_engine
eng = create_engine("starrocks://x:y@h:9030/d")
print("dialect:", eng.dialect.name, "/ driver:", eng.dialect.driver)
EOF
# 期望: dialect: starrocks / driver: pymysql
```

> 详见 [Q16](#q16-页面报-db-engine-error--cant-load-plugin-sqlalchemydialectsxxx)。

### 7.3 自检

```bash
which superset                  # /opt/superset/venv/bin/superset

# 7.3.1 仅 import 自检（不进 Flask 应用初始化，最干净）
python -c "import superset; print('PKG:', superset.__file__)"
# 期望: /opt/superset/venv/lib/python3.X/site-packages/superset/__init__.py

# 7.3.2 关键依赖版本是否对齐到 base.txt
pip show numpy gunicorn gevent pandas | grep -E '^(Name|Version)'
# 期望：numpy 1.26.4 / gunicorn 23.0.0 / gevent 24.x / pandas 2.1.4

# 7.3.3 superset CLI 自检
superset version
```

> **`superset version` 的两类输出，都不是失败**：
>
> | 输出 | 含义 |
> |---|---|
> | 正常版本号（如 `4.x.x`） | 完美，import + Flask 启动均 OK |
> | `Refusing to start due to insecure SECRET_KEY` | import 链路完全通，只是 `superset_config.py` 还没写、Flask 拒绝用默认弱 SECRET_KEY 启动。**这是预期行为**，继续走第九节即可 |
>
> 只有出现 `AttributeError: module 'numpy' has no attribute 'product'` 才是真失败——看 [Q11](#q11-superset-version-报-module-numpy-has-no-attribute-product)。

```bash
cp /tmp/BUILD_COMMIT.txt /opt/superset/.deployed_commit
cat /opt/superset/.deployed_commit
```

### 7.4 删 wheel 文件（已安装完，磁盘释放）

```bash
# 注意：约束文件 base.txt 留着，升级时还要用
rm -f /tmp/apache_superset-*.whl /tmp/BUILD_COMMIT.txt
# 把约束文件搬到 /opt/superset/ 永久保留
mv /tmp/superset-base-constraints.txt /opt/superset/base-constraints.txt
```

### 7.5 已经误装了新版依赖的修复方法

如果你跳过了 `-c` 步骤，已经装上了 numpy 2.x / gunicorn 26.x 等，按下面一键修复：

```bash
source /opt/superset/venv/bin/activate

# 用约束文件强制把所有依赖对齐回 Superset 官方版本
pip install --force-reinstall -r <(pip freeze | awk -F'==' '{print $1}') \
    -c /opt/superset/base-constraints.txt

# 或者更简单：仅重装关键几个
pip install --force-reinstall \
    'numpy==1.26.4' 'pandas==2.1.4' 'gunicorn==23.0.0' 'gevent>=24.2.1,<25' \
    'packaging<25'

superset version    # 应能正常输出版本号
```

---

## 八、云服务器：准备元数据库与 Redis

> 按你选的方式做。如果元数据库**已存在**（升级场景），跳到 [9.5 已有库的升级注意](#95-已有库的升级注意)。

### 8.1 方案 A：元数据库用云厂商托管 RDS（推荐生产）

直接在云厂商控制台开实例：

| 厂商 | MySQL 8 产品名 | PostgreSQL 产品名 |
|---|---|---|
| 阿里云 | RDS MySQL | RDS PostgreSQL |
| 腾讯云 | TencentDB for MySQL | TencentDB for PostgreSQL |
| AWS | RDS MySQL 或 Aurora MySQL | RDS PostgreSQL 或 Aurora PG |
| GCP | Cloud SQL MySQL | Cloud SQL PostgreSQL |

建实例后，进 控制台 → 安全组 / 白名单 → 允许 Superset 云服务器的内网 IP，然后 SQL 客户端建库：

```sql
-- MySQL
CREATE DATABASE superset DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'superset'@'%' IDENTIFIED BY '<random-strong-pwd>';
GRANT ALL PRIVILEGES ON superset.* TO 'superset'@'%';
FLUSH PRIVILEGES;
```

### 8.2 方案 B：元数据库与 Superset 同机 docker

如果不用云托管，最简单是云服务器自建：

```bash
# 装 docker
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker superset

# MySQL
docker run -d --name superset-mysql \
    -p 127.0.0.1:3306:3306 \
    -e MYSQL_ROOT_PASSWORD='<root-pwd>' \
    -e MYSQL_DATABASE=superset \
    -e MYSQL_USER=superset \
    -e MYSQL_PASSWORD='<superset-pwd>' \
    --restart unless-stopped \
    -v superset-mysql-data:/var/lib/mysql \
    mysql:8.0 \
    --character-set-server=utf8mb4 \
    --collation-server=utf8mb4_unicode_ci
```

或 PostgreSQL：

```bash
docker run -d --name superset-postgres \
    -p 127.0.0.1:5432:5432 \
    -e POSTGRES_USER=superset \
    -e POSTGRES_PASSWORD='<superset-pwd>' \
    -e POSTGRES_DB=superset \
    --restart unless-stopped \
    -v superset-pg-data:/var/lib/postgresql/data \
    postgres:17
```

### 8.3 Redis

云厂商托管或同机自建：

```bash
docker run -d --name superset-redis \
    -p 127.0.0.1:6379:6379 \
    --restart unless-stopped \
    -v superset-redis-data:/data \
    redis:7 \
    redis-server --appendonly yes
```

### 8.4 连通验证

```bash
mysql -h <DB_HOST> -P 3306 -u superset -p superset -e "SELECT VERSION();"
redis-cli -h <REDIS_HOST> -p 6379 ping     # 期望 PONG
```

### 8.5 已有库的升级注意

```bash
mysql -h <DB_HOST> -u superset -p superset -e "SELECT version_num FROM alembic_version;"
```

**强烈建议先备份**：

```bash
mysqldump --single-transaction --routines --triggers --events \
    -h <DB_HOST> -u superset -p superset \
    | gzip > /opt/backup/superset_db_$(date +%F).sql.gz
```

---

## 九、编写 `superset_config.py`

在 `/opt/superset/superset_config.py` 创建生产配置。

### 9.1 生成强 `SECRET_KEY`

```bash
openssl rand -base64 42
# 输出类似 tACUIugvzJlk6kA4Z3fDmlbn3LuYv4X8Xmu2pPWt+zhSgy3UAMleKomL
```

### 9.2 最小可用模板

```python
# /opt/superset/superset_config.py
"""Production configuration for Superset (deployed via wheel)."""
from cachelib.redis import RedisCache

SECRET_KEY = "<把上面 openssl rand 的输出贴这里>"

# ---- 数据库 ---------------------------------------------------------------

SQLALCHEMY_DATABASE_URI = (
    "mysql+mysqldb://superset:<superset-pwd>@<DB_HOST>:3306/superset"
    "?charset=utf8mb4"
)
# Postgres: "postgresql+psycopg2://superset:<pwd>@<DB_HOST>:5432/superset"

SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ENGINE_OPTIONS = {
    "pool_pre_ping": True,
    "pool_recycle": 1800,
    "pool_size": 10,
    "max_overflow": 20,
}

# ---- 缓存与异步队列 -------------------------------------------------------

REDIS_HOST = "<REDIS_HOST>"
REDIS_PORT = 6379

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": 1,
}
DATA_CACHE_CONFIG = CACHE_CONFIG
FILTER_STATE_CACHE_CONFIG = {**CACHE_CONFIG, "CACHE_DEFAULT_TIMEOUT": 86400}
EXPLORE_FORM_DATA_CACHE_CONFIG = {**CACHE_CONFIG, "CACHE_DEFAULT_TIMEOUT": 86400}

RESULTS_BACKEND = RedisCache(host=REDIS_HOST, port=REDIS_PORT, key_prefix="sql_results_", db=2)

class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/1"
    worker_prefetch_multiplier = 1
    task_acks_late = False

CELERY_CONFIG = CeleryConfig

# ---- 生产开关 -------------------------------------------------------------

DEBUG = False
WTF_CSRF_ENABLED = True
WTF_CSRF_TIME_LIMIT = 60 * 60 * 24 * 7
TALISMAN_ENABLED = True
TALISMAN_CONFIG = {
    "content_security_policy": None,
    "force_https": False,
    "session_cookie_secure": False,
}

# ---- 行为 -----------------------------------------------------------------

ROW_LIMIT = 100000
SUPERSET_WEBSERVER_TIMEOUT = 120
SUPERSET_WEBSERVER_PORT = 8088
ENABLE_PROXY_FIX = True

FEATURE_FLAGS = {
    "ALERT_REPORTS": False,
    "DASHBOARD_RBAC": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
}
```

### 9.3 自定义安全管理器（可选）

如果你的 fork 改了认证逻辑（自定义 SSO/OAuth/LDAP），把 SecurityManager 类与配置放同目录：

```python
from superset.security import SupersetSecurityManager

class CompanySsoSecurityManager(SupersetSecurityManager):
    def oauth_user_info(self, provider, response=None):
        ...
    def auth_user_oauth(self, userinfo):
        ...

CUSTOM_SECURITY_MANAGER = CompanySsoSecurityManager
```

### 9.4 权限收紧与验证

```bash
chmod 600 /opt/superset/superset_config.py

source /opt/superset/venv/bin/activate
export SUPERSET_CONFIG_PATH=/opt/superset/superset_config.py

python -m py_compile /opt/superset/superset_config.py
python -c "
import sys; sys.path.insert(0, '/opt/superset')
import superset_config as c
print('DB:', c.SQLALCHEMY_DATABASE_URI.split('@')[-1])
print('SECRET_KEY length:', len(c.SECRET_KEY))
assert len(c.SECRET_KEY) >= 32, 'SECRET_KEY too short'
print('OK')
"
```

---

## 十、初始化或升级元数据库

### 10.1 场景 A：全新部署

```bash
cd /opt/superset
source venv/bin/activate
export SUPERSET_CONFIG_PATH=/opt/superset/superset_config.py
export FLASK_APP=superset.app:create_app

superset db upgrade

superset fab create-admin \
    --username admin \
    --firstname Admin \
    --lastname User \
    --email admin@example.com \
    --password '<change-me>'

superset init
```

### 10.2 场景 B：升级（已有元数据库）

> ⚠️ **这一步是 mandatory，不是可选**。如果跳过，代码升级到 6.1 但库 schema 还停在旧版，dashboard / dataset / chart 等页面会 500：
> ```
> SupersetApiError: Fatal error
> sqlalchemy.exc.OperationalError: (1054, "Unknown column 'tables.currency_code_column' in 'field list'")
> ```
> 详见 [Q15](#q15-升级后浏览器报-supersetapierror-fatal-error--unknown-column-1054)。

```bash
cd /opt/superset
source venv/bin/activate
export SUPERSET_CONFIG_PATH=/opt/superset/superset_config.py
export FLASK_APP=superset.app:create_app

# 第 1 步：先看一眼当前在哪个 revision、距离 head 多远
superset db current                                                    # 库里当前版本
superset db heads                                                       # 代码期望版本
superset db history --rev-range=<current>:head | head -50              # 中间要跑哪些迁移

# 第 2 步：停服务（避免 upgrade 期间应用乱写元数据库）
sudo systemctl stop superset

# 第 3 步：备份元数据库（即使 8.5 节已备份过，再保险一次）
mkdir -p /opt/superset/backup
mysqldump -h <metadb-host> -u <user> -p<password> <db> \
    > /opt/superset/backup/superset-pre-upgrade-$(date +%F-%H%M).sql

# 第 4 步：执行升级（tee 日志方便事后排查）
superset db upgrade 2>&1 | tee /opt/superset/backup/db_upgrade_$(date +%F).log

# 第 5 步：同步新版的权限/菜单（6.1 引入 semantic_layer/view 权限等）
superset init

# 第 6 步：验证已经到 head
superset db current        # 应输出 head 对应的 revision

# 第 7 步：恢复服务
sudo systemctl start superset
```

> 第 4 步若中断，alembic 可能卡在中间版本——**用第 3 步的 dump 整库 restore 后再重跑**。

---

## 十一、systemd 托管

### 11.1 主服务

`sudo vim /etc/systemd/system/superset.service`：

```ini
[Unit]
Description=Apache Superset
After=network.target

[Service]
Type=simple
User=superset
Group=superset
WorkingDirectory=/opt/superset

Environment="PATH=/opt/superset/venv/bin"
Environment="SUPERSET_CONFIG_PATH=/opt/superset/superset_config.py"
Environment="FLASK_APP=superset.app:create_app()"
Environment="PYTHONUNBUFFERED=1"

ExecStart=/opt/superset/venv/bin/gunicorn \
    --workers 4 \
    --worker-class gevent \
    --worker-connections 1000 \
    --timeout 120 \
    --keep-alive 5 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --bind 0.0.0.0:8088 \
    --access-logfile /var/log/superset/access.log \
    --error-logfile /var/log/superset/error.log \
    --log-level info \
    "superset.app:create_app()"

Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

| 参数 | 取值建议 |
|---|---|
| `--workers` | `2 × CPU 核数 + 1`（云机 2 核写 5，4 核写 9） |
| `--worker-class` | `gevent` |
| `--worker-connections` | 1000 |
| `--timeout` | 120（大查询场景 300） |
| `--max-requests` | 1000（防内存泄漏累积） |
| `LimitNOFILE` | 65536 |

### 11.2 启动 + 验证

```bash
sudo mkdir -p /var/log/superset
sudo chown superset:superset /var/log/superset

sudo systemctl daemon-reload
sudo systemctl start superset
sudo systemctl status superset --no-pager

curl -fsS http://127.0.0.1:8088/health                       # 应返回 OK
curl -o /dev/null -s -w "%{http_code}\n" http://127.0.0.1:8088/login/      # 应返回 200
```

### 11.3 开机自启

仅在功能完整验证后：

```bash
sudo systemctl enable superset
```

### 11.4（可选）Celery worker / beat

只有用到 Alert/Report、CSV 异步导出、SQL Lab 异步查询时才需要。两个 unit：

`/etc/systemd/system/superset-worker.service`：

```ini
[Unit]
Description=Apache Superset Celery worker
After=network.target superset.service

[Service]
Type=simple
User=superset
Group=superset
WorkingDirectory=/opt/superset
Environment="PATH=/opt/superset/venv/bin"
Environment="SUPERSET_CONFIG_PATH=/opt/superset/superset_config.py"
ExecStart=/opt/superset/venv/bin/celery --app=superset.tasks.celery_app:app worker \
    --pool=prefork --loglevel=info --concurrency=4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/superset-beat.service`：

```ini
[Unit]
Description=Apache Superset Celery beat (scheduler)
After=network.target superset.service

[Service]
Type=simple
User=superset
Group=superset
WorkingDirectory=/opt/superset
Environment="PATH=/opt/superset/venv/bin"
Environment="SUPERSET_CONFIG_PATH=/opt/superset/superset_config.py"
ExecStart=/opt/superset/venv/bin/celery --app=superset.tasks.celery_app:app beat \
    --loglevel=info
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now superset-worker superset-beat
```

---

## 十二、（可选）nginx 反代 + HTTPS

生产环境强烈建议 nginx 终结 HTTPS。

```bash
sudo apt-get install -y nginx
```

`/etc/nginx/sites-available/superset.conf`：

```nginx
upstream superset {
    server 127.0.0.1:8088;
    keepalive 32;
}

server {
    listen 80;
    server_name superset.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name superset.example.com;

    ssl_certificate     /etc/letsencrypt/live/superset.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/superset.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 100M;

    # 静态资源直接由 nginx 出，绕开 gunicorn
    location /static/ {
        alias /opt/superset/venv/lib/python3.10/site-packages/superset/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://superset;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header Connection        "";
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/superset.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

> 开 HTTPS 时同步改 `superset_config.py`：
>
> - `ENABLE_PROXY_FIX = True`（已建议开）
> - `TALISMAN_CONFIG["session_cookie_secure"] = True`
> - `TALISMAN_CONFIG["force_https"] = True`（可选）
>
> 改完 `sudo systemctl restart superset`。

---

## 十三、升级与回滚剧本

### 13.1 滚动升级（每次发新版）

> 日常迭代**不需要**走第二节到第十二节的完整剧本，只走本节即可。**首次部署做过一次的事**（系统包 / 创建 venv / 装 PyMySQL/cachetools/数据库方言 / 写 systemd / nginx / 元数据库初始化）**永远不用重做**。

#### 13.1.1 决策表：根据本次改动选步骤

| 本次改动类型 | 必做步骤 |
|---|---|
| **A. 仅 Python 代码、无新依赖、无 migration** | 主 wheel 重打 → 云端 `pip install --force-reinstall --no-deps` → restart |
| **B. 改了前端（`superset-frontend/**`）** | 同 A，且构建时必须 `npm run build` 重出前端产物 |
| **C. 改了 `superset-core/**` 子包** | 同 A/B + **重打 superset-core 子 wheel** → 云端单独 `pip install --force-reinstall --no-deps` |
| **D. 新增 alembic migration（`superset/migrations/versions/*.py`）** | 同 A/B/C + 云端 `superset db upgrade` |
| **E. 改了权限/菜单（新 view、新 permission）** | 同 D + 云端 `superset init` |
| **F. 改了 `pyproject.toml` 增删依赖** | 主 wheel 装时不要带 `--no-deps`，改用 `--force-reinstall --upgrade` 让 pip 重新解析依赖图 |
| **G. 改了 `superset_config.py`** | scp 新 config 到云端 + restart |
| **H. 改了 systemd unit / nginx** | `sudo systemctl daemon-reload` + restart 对应服务 |

以下三档剧本覆盖 95% 的发布场景，按你的改动从最轻到最重选其中一档。

#### 13.1.2 剧本一：90% 场景（仅 Python + 前端，无 migration，预计 5-10 分钟）

**构建机**：

```bash
cd /opt/superset-build

# 1. 同步最新代码
git fetch origin master
git log --oneline HEAD..origin/master                         # 看本次包了哪些 commits
git reset --hard origin/master
mkdir -p dist && git rev-parse HEAD > dist/BUILD_COMMIT.txt

# 2. 重 build 前端（如果只动了 Python，可跳过这步以节省时间）
cd superset-frontend
NODE_OPTIONS="--max-old-space-size=4096" npm run build
cd /opt/superset-build

# 3. 重打主 wheel
source build-venv/bin/activate
rm -rf dist/apache_superset-*.whl build *.egg-info
python -m build --wheel

# 4. 传到云端
scp dist/apache_superset-*.whl dist/BUILD_COMMIT.txt <user>@<cloud-host>:/tmp/
```

**云服务器**（停机 < 1 分钟）：

```bash
TS=$(date +%F-%H%M)

# 1. 备份当前 venv（升级失败可秒级回滚，见 13.2）
sudo systemctl stop superset
sudo cp -a /opt/superset/venv /opt/superset/backup/venv_${TS}

# 2. 装新主 wheel（无新依赖时用 --no-deps 跳过 ~200 个包的依赖解析，几秒就装完）
source /opt/superset/venv/bin/activate
pip install /tmp/apache_superset-*.whl --force-reinstall --no-deps

# 3. 更新 commit 标记
cp /tmp/BUILD_COMMIT.txt /opt/superset/.deployed_commit
cat /opt/superset/.deployed_commit                          # 确认是本次的 commit
rm -f /tmp/apache_superset-*.whl /tmp/BUILD_COMMIT.txt

# 4. 起服务 + 健康检查
sudo systemctl start superset
sleep 5
sudo systemctl is-active superset                           # 期望 active
curl -fsS http://127.0.0.1:8088/health                      # 期望 OK
```

#### 13.1.3 剧本二：含 alembic migration（D / E 场景）

在剧本一**第 3 步装完 wheel 之后**、第 4 步起服务之前，加：

```bash
# 备份元数据库（schema 变更前必做）
mysqldump --single-transaction --routines --triggers \
    -h <DB_HOST> -u superset -p<DB_PASSWORD> superset \
    | gzip > /opt/superset/backup/db_${TS}.sql.gz

# 升级 schema
export SUPERSET_CONFIG_PATH=/opt/superset/superset_config.py
export FLASK_APP=superset.app:create_app

superset db current      # 看升级前 revision，记下来回滚要用
superset db upgrade      # 跑新增的 migration
superset init            # 同步新增的 permission/menu (E 场景才需要，但跑一遍无副作用)
superset db current      # 期望 head 对应 revision
```

> 关于 `superset init`：它会**只增不减**地同步代码里声明的 permission，对老 permission 是兼容的。如果不确定本次有没有新 permission，跑一下不会出问题。

#### 13.1.4 剧本三：动到 `superset-core/**` 子包（C 场景）

在剧本一**第 3 步**和**第 4 步之间**，加构建 + 装 superset-core 子 wheel：

**构建机**追加：

```bash
cd /opt/superset-build
rm -f dist/apache_superset_core-*.whl
python -m build --wheel --outdir dist ./superset-core
scp dist/apache_superset_core-*.whl <user>@<cloud-host>:/tmp/
```

**云端**（在主 wheel 安装之后）追加：

```bash
pip install /tmp/apache_superset_core-*.whl --force-reinstall --no-deps
rm -f /tmp/apache_superset_core-*.whl
```

> 如何判断本次有没有动 superset-core？构建机上 `git diff --name-only HEAD@{1} HEAD -- superset-core/ | head` 看输出是否为空。空 → 跳过这档；非空 → 必走。

#### 13.1.5 总耗时对照

| 剧本 | 构建机时间 | 云端停机时间 | 总时长 |
|---|---|---|---|
| 一（90% 场景） | 3-5 分钟（前端 build 占大头） | < 1 分钟 | **5-10 分钟** |
| 二（含 migration） | 同上 | 1-3 分钟（看 migration 量） | 10-15 分钟 |
| 三（含 superset-core） | 同上 + 30 秒 | < 1 分钟 | 5-10 分钟 |

### 13.2 整体回滚（升级失败时）

云服务器上：

```bash
TS=<升级时的时间戳>

sudo systemctl stop superset

# 1. 还原 venv（最快路径）
sudo rm -rf /opt/superset/venv
sudo mv /opt/backup/venv_${TS} /opt/superset/venv

# 2. 还原数据库（仅当跑过 db upgrade 时需要）
gunzip -c /opt/backup/db_${TS}.sql.gz | \
    mysql -h <DB_HOST> -u superset -p superset

sudo systemctl start superset
curl -fsS http://127.0.0.1:8088/health
```

预计 **3-5 分钟**。

---

## 十四、常见问题排查

### Q1. `pip install xxx.whl` 报 `mysql_config: not found`

云服务器没装 MySQL 开发头文件——回到第六节：

```bash
sudo apt-get install -y default-libmysqlclient-dev pkg-config
```

### Q2. `python -m build` 报 `error: Microsoft Visual C++ 14.0 is required`

你在 Windows 上跑构建。**强烈建议改用 Linux 虚拟机 / WSL2 作构建机**——Windows 上跑 Superset 前端 build 有路径分隔符 / symlink / IO 速度等多个坑。

### Q3. 启动后浏览器白屏 / `/static/assets/*` 404

wheel 里没打进前端产物。回到 4.2 → 4.5 验证：

```bash
unzip -l /tmp/apache_superset-*.whl | grep "static/assets/manifest.json"
```

若 grep 无输出，说明前端没 build 进去——4.2 步前端 build 没跑或没成功。

### Q4. 升级后命令 `superset` 找不到

激活 venv 后再用：

```bash
source /opt/superset/venv/bin/activate
which superset      # /opt/superset/venv/bin/superset
```

或用绝对路径 `/opt/superset/venv/bin/superset --help`。

### Q5. 服务起不来，`code=exited, status=3/NOTIMPLEMENTED`

通常是 `superset_config.py` 里 import 失败或 `SECRET_KEY` 缺失。看 journalctl：

```bash
sudo journalctl -u superset -n 100 --no-pager
```

逐项修：

- `ImportError`：检查自定义 SecurityManager 是否引用了不存在的 6.0/6.1 API
- `SECRET_KEY` 报错：第 9.1 节生成
- 数据库连不上：检查 `SQLALCHEMY_DATABASE_URI` 与 RDS 安全组白名单

### Q6. `superset db upgrade` 卡在某个 migration

跨大版本升级时大表 alter 可能要几分钟到几十分钟。**先看是不是真卡住**：

```bash
mysql -h <DB_HOST> -u superset -p superset -e "SHOW PROCESSLIST;"
```

如果有 `ALTER TABLE` 状态在跑，**不要中断**。真死锁则按 13.2 整库回滚。

### Q7. gunicorn worker 频繁 `WORKER TIMEOUT`

慢查询超过 `--timeout 120`。加大 timeout 到 300 或定位慢 SQL 优化数据源。

### Q8. 验证「云上跑的就是我 fork 的最新 commit」

```bash
# 云服务器
cat /opt/superset/.deployed_commit
/opt/superset/venv/bin/pip show apache-superset | grep Version
/opt/superset/venv/bin/python -c "import superset, os; print(os.path.dirname(superset.__file__))"
```

`/opt/superset/.deployed_commit` 应等于构建机上 `git rev-parse HEAD`。

### Q9. 想加新的 Python 依赖（fork 引入了新库）

两种方式：

1. 把依赖加进 [pyproject.toml](../../../pyproject.toml) 的 `dependencies`，下一次出 wheel 时自动带（推荐）
2. 临时在云上 `pip install <pkg>`，重启 systemd（不可持续，下次升级 wheel 会被洗掉）

### Q10. wheel 文件越来越大（push 多次后）

`python -m build` 每次跑前应清理：

```bash
cd /opt/superset-build
rm -rf dist build *.egg-info
python -m build --wheel
```

### Q11. `superset version` 报 `module 'numpy' has no attribute 'product'`

完整报错：

```
File ".../superset/utils/pandas_postprocessing/utils.py", line 49, in <module>
    "product": np.product,
File ".../numpy/__init__.py", line 414, in __getattr__
    raise AttributeError("module {!r} has no attribute "
AttributeError: module 'numpy' has no attribute 'product'
```

**根本原因（含上游真相）**：

- `np.product` 在 numpy 1.x 就已 deprecated（一直是 `np.prod` 的别名），numpy 2.0 起被**彻底移除**
- **apache/superset 上游 master 和 6.1.0 tag 至今都仍在使用 `np.product`**（见 [superset/utils/pandas_postprocessing/utils.py](../../../superset/utils/pandas_postprocessing/utils.py) 第 49 行）。这不是你 fork 的问题，是上游的隐藏 bug
- 上游之所以 CI 不爆，是因为 [requirements/base.txt](../../../requirements/base.txt) 第 248 行把 `numpy==1.26.4` 精确锁定，把雷藏住了
- [pyproject.toml](../../../pyproject.toml) 第 75 行的 `numpy>1.23.5, <2.3` 松散区间允许 numpy 2.x，wheel 里只声明松散区间没有把 base.txt 内嵌进去

**触发场景**：第七节 `pip install xxx.whl` 时**漏带了 `-c base-constraints.txt`**，pip 按松散区间拉到了 numpy 2.2.x，上游埋的雷被踩响。

> **本仓库（fork）已修复**：commit `e165b01` 把 `np.product` 改成 `np.prod`，下次重新出 wheel 即彻底消除问题。同样这个 1 行修复**可以 PR 回 apache 上游**，详见文末附录 G。

**修复路径，按优先级**：

#### A. 推荐：按约束文件重装到 Superset 测试过的版本

```bash
source /opt/superset/venv/bin/activate

pip install --force-reinstall \
    'numpy==1.26.4' 'pandas==2.1.4' \
    'gunicorn==23.0.0' 'gevent>=24.2.1,<25' \
    'packaging<25'

superset version    # 此时应能正常输出版本号或 SECRET_KEY 告警
```

或者如果你已经把 `base-constraints.txt` 拷到了云机器，直接（参考 7.5 节）：

```bash
pip install --force-reinstall -r <(pip freeze | awk -F'==' '{print $1}') \
    -c /opt/superset/base-constraints.txt
```

#### B. 紧急热修：直接改 site-packages

如果你已经上线、不想立刻重装一堆依赖，可以**临时**只改这一行：

```bash
FILE=/opt/superset/venv/lib/python3.10/site-packages/superset/utils/pandas_postprocessing/utils.py
cp "$FILE" "$FILE.bak"
sed -i 's/np\.product/np.prod/g' "$FILE"
grep -n 'np.prod' "$FILE"   # 确认 line 48 与 49 都是 np.prod
```

> 这种方式有效，但下一次 `pip install xxx.whl --force-reinstall` 时改动会被覆盖；治本仍要回到 A 路径或者 C 路径。

#### C. 永久修复：修 fork 源码并重出 wheel

构建机上：

```bash
cd /opt/superset-build
# 编辑 superset/utils/pandas_postprocessing/utils.py，把
#   "product": np.product,
# 改成
#   "product": np.prod,
git add superset/utils/pandas_postprocessing/utils.py
git commit -m "fix(utils): replace np.product (removed in numpy 2.0) with np.prod"
git push origin master

rm -rf dist build *.egg-info
python -m build --wheel
```

下次 push 出的 wheel 就再也不会有这个坑。

**附加注意**：`superset version` 即使 import 成功，如果尚未写好 `superset_config.py`、`SECRET_KEY` 还是默认弱值，会直接报：

```
Refusing to start due to insecure SECRET_KEY
```

**这其实是好消息**——说明 import 链路已经完全通了，只是被生产安全检查挡住。继续走第九节写 `superset_config.py` 设强 `SECRET_KEY` 后，`superset version` 就会正常输出版本号。

### Q12. 启动后 systemd 反复重启 + `No module named 'pymysql'`

完整 traceback：

```
File ".../sqlalchemy/dialects/mysql/pymysql.py", line 80, in dbapi
    return __import__("pymysql")
ModuleNotFoundError: No module named 'pymysql'
[ERROR] Worker failed to boot.
```

**根因**：`superset_config.py` 里 `SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://...'`，但你只装了 `mysqlclient`（对应协议 `mysql+mysqldb://`）。两个驱动是**不同的 PyPI 包**：

| URI 协议 | 需要的包 |
|---|---|
| `mysql+mysqldb://` | `mysqlclient` |
| `mysql+pymysql://` | `PyMySQL` |

**修复**：装上对应的包即可：

```bash
source /opt/superset/venv/bin/activate
pip install 'PyMySQL>=1.1.0' -c /opt/superset/base-constraints.txt
sudo systemctl restart superset
```

> 或者反过来，把 `superset_config.py` 里的 URI 改成 `mysql+mysqldb://`，配套装 `mysqlclient`。两种都行，按你的运维习惯选。

### Q13. 启动后 systemd 反复重启 + `No module named 'superset_core.semantic_layers'`

完整 traceback：

```
File ".../superset/semantic_layers/models.py", line 38, in <module>
    from superset_core.semantic_layers.layer import (
ModuleNotFoundError: No module named 'superset_core.semantic_layers'
```

**根因**：Superset 6.1 是 **monorepo**——`superset_core` 包来自仓库根的 `superset-core/` 子目录，它在 [pyproject.toml:21](../../../superset-core/pyproject.toml) 中 `version = "0.1.0"` 跟 PyPI 上已发布的版本号**完全一样**，但仓库源码比 PyPI 上的发布版**多了 `semantic_layers/` 等子模块**。

如果你在构建机只 `python -m build --wheel`（默认只打主包），云端 pip 安装主 wheel 时会去 PyPI 拉 `apache-superset-core==0.1.0`（缺 `semantic_layers/`），结果主代码 import 时崩。

**修复方案**：

#### A. 推荐：把仓库的 superset-core 子目录在云端 venv 里强制覆盖装一次

```bash
# 把 superset-core 子目录拷到云机（仅几十 KB）
scp -r /opt/superset-build/superset-core <user>@<cloud-host>:/tmp/

# 在云机的 venv 里强装
source /opt/superset/venv/bin/activate
pip install /tmp/superset-core --force-reinstall --no-deps

# 验证
ls /opt/superset/venv/lib/python3.10/site-packages/superset_core/
# 应该看到 semantic_layers/ 子目录

sudo systemctl restart superset
```

#### B. 治本：构建机预先把 superset-core 也打成 wheel

按 [4.4 节](#44-打-wheel两个主包--superset-core-子包) 重新构建时多跑一行：

```bash
python -m build --wheel --outdir dist ./superset-core
```

然后 [第五节](#五传输到云服务器) 把两个 wheel 一并 scp 到云端，[7.1 节](#71-装-wheel-本体主包--superset-core-都要装务必用--c-约束文件)装完主 wheel 后用 `--force-reinstall --no-deps` 装上 superset-core wheel。这才是文档的"正确路径"。

### Q14. 页面 500 报 `No module named 'cachetools'`

服务起来了（`/health` 返回 200），但浏览器访问任何 SPA 页面（`/login/`、`/superset/welcome/`）都报 500。journalctl 看到：

```
File ".../superset/db_engine_specs/aws_iam.py", line 35, in <module>
    from cachetools import TTLCache
ModuleNotFoundError: No module named 'cachetools'
```

**根因**：`superset/db_engine_specs/aws_iam.py` 用了 `cachetools.TTLCache`，但 [pyproject.toml](../../../pyproject.toml) 里**没声明**这个依赖，pip install wheel 时不会自动拉。这是 apache 上游 6.1 的**隐藏 bug**（声明缺失）。

触发场景：通过 SPA 入口加载时，`get_available_engine_specs()` 会 importlib 把所有 `db_engine_specs/*.py` 模块都 import 一遍，触发 `aws_iam.py` 加载 → import cachetools 失败。

**修复**：

```bash
source /opt/superset/venv/bin/activate
pip install cachetools -c /opt/superset/base-constraints.txt
sudo systemctl restart superset

curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8088/login/
# 期望: 200
```

> **建议**: fork 自己用的时候，把 `cachetools` 补到 [pyproject.toml](../../../pyproject.toml) 的 `[project] dependencies` 里，下次构建的 wheel 就会自动声明这个依赖，云端 pip 也会自动装。这个一行修复也可以 [PR 回上游](#附录-g把本地修复-pr-回-apache-上游)。

### Q15. 升级后浏览器报 `SupersetApiError: Fatal error` + `Unknown column ... (1054)`

登录后访问 dashboard、charts、datasets 等任何业务页面，浏览器弹错：

```
Unexpected error
SupersetApiError: Fatal error
```

journalctl 看到：

```
sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError)
  (1054, "Unknown column 'tables.currency_code_column' in 'field list'")
```

（PostgreSQL 报的是 `psycopg2.errors.UndefinedColumn`，原理一样。）

**根因**：你升级了 **代码** 到 6.1，但**没升级元数据库 schema**——alembic migration 没跑。`tables.currency_code_column` 等新字段在 ORM 模型里有、库里却没有，任何查 `tables` 表的 API 都会 1054。

> 跑 `superset version` 时它会提示 `Pending database migrations: run 'superset db upgrade'`，很容易被忽略。

**修复**：补跑 [10.2 节](#102-场景-b升级已有元数据库)。最小命令：

```bash
sudo systemctl stop superset

source /opt/superset/venv/bin/activate
export SUPERSET_CONFIG_PATH=/opt/superset/superset_config.py
export FLASK_APP=superset.app:create_app

# 备份（保险）
mysqldump -h <metadb-host> -u <user> -p<password> <db> \
    > /opt/superset/backup/superset-pre-upgrade-$(date +%F-%H%M).sql

# 升级
cd /opt/superset
superset db upgrade
superset init

# 验证已经到 head
superset db current

sudo systemctl start superset
```

之后浏览器**强制刷新**（Ctrl+Shift+R）清掉前端缓存，页面就正常了。

> **常见误区**：以为"我之前 6.0.1 跑得好好的，pip install 新 wheel 后什么都没动元数据库怎么会变"。元数据库 schema 由代码里的 [alembic migration 脚本](../../../superset/migrations/versions/) 单向驱动，**版本升一次必跑一次 upgrade**，否则代码与库永远不在同一个 revision。

### Q16. 页面报 `DB engine Error` + `Can't load plugin: sqlalchemy.dialects:xxx`

完整文案：

```
DB engine Error
Can't load plugin: sqlalchemy.dialects:starrocks
This may be triggered by: Issue 1011 - Superset encountered an unexpected error.
```

**根因**：你在 Superset 里建了一个连业务数据库（如 StarRocks / Clickhouse / Doris / Trino...）的 Database 连接，但**新部署的 venv 里没装这个数据库的 SQLAlchemy 方言包**。元数据库表里那条连接记录还在，但当 superset 创建 engine 时 SQLAlchemy 找不到对应的 plugin。

> 这非常容易在"从旧 venv 升级到新 venv / 换机器部署"时出现——旧 venv 装过的方言包没自动带过来。

**修复**：在新 venv 装上对应方言包，重启服务。

```bash
source /opt/superset/venv/bin/activate

# 按你的 URI 协议选包（完整速查表见 7.2.4 节）：
pip install 'starrocks==1.3.3' -c /opt/superset/base-constraints.txt
# pip install clickhouse-connect -c /opt/superset/base-constraints.txt
# pip install pydoris -c /opt/superset/base-constraints.txt
# pip install trino -c /opt/superset/base-constraints.txt

sudo systemctl restart superset
```

> **判断到底缺哪个方言**：错误消息最后一段 `sqlalchemy.dialects:xxx` 中的 `xxx` 就是 URI 前缀，对应 [7.2.4 节速查表](#724-业务数据库的-sqlalchemy-方言包连什么库就装什么方言)中的 pip 包名。

> **如何系统性避免**：部署完后立刻在新 venv 里 `pip list` 跟旧 venv `pip list` 做一次 diff，把所有旧 venv 装过的、与业务数据库相关的方言包全部补装：
> ```bash
> # 在旧 venv 所在机器上提前导出
> pip list --format=freeze | grep -iE 'starrocks|clickhouse|doris|hive|trino|druid|snowflake|bigquery|databricks|oracledb|pyodbc|pymongo' \
>     > /tmp/business-db-drivers.txt
> # 传到新机器
> scp /tmp/business-db-drivers.txt <user>@<cloud-host>:/tmp/
> # 在新 venv 一次性装
> pip install -r /tmp/business-db-drivers.txt -c /opt/superset/base-constraints.txt
> ```

### Q17. StarRocks 报 `(5078, "Unknown catalog 'xxx'")`，但用 mysql client 直连能通

完整错误：

```
ERROR: (builtins.NoneType) None
[SQL: (pymysql.err.OperationalError) (5078, "Unknown catalog 'bluetti'")
```

并且用 `mysql -h <host> -P 19030 -u <user> -p` 直连、或者 SQLAlchemy 单独跑 `create_engine("starrocks://.../bluetti").connect()` 都能通。

**根因（6.0.1 → 6.1 的行为变化）**：

Superset 6.1 给 StarRocks engine spec 引入了**多 catalog 支持**（见 [superset/db_engine_specs/starrocks.py:102](../../../superset/db_engine_specs/starrocks.py)）：

```python
supports_catalog = supports_dynamic_catalog = supports_cross_catalog_queries = True
sqlalchemy_uri_placeholder = "starrocks://user:password@host:port[/catalog.db]"
```

6.1 在 `adjust_engine_params()` 里会把 URI 的 database 段按 **"catalog.schema"** 两段式解析（[第 265-275 行](../../../superset/db_engine_specs/starrocks.py)）：

```python
if uri.database and "." in uri.database:
    current_catalog, current_schema = uri.database.split(".", 1)
elif uri.database:
    current_catalog, current_schema = uri.database, None   # ← 没点号时把整段当 catalog
```

也就是说：
- URI `.../bluetti`（无点号）→ 被解释为 `catalog=bluetti, schema=空` → 向 StarRocks 发 `SET CATALOG bluetti` → StarRocks 找不到名叫 bluetti 的 catalog（因为 bluetti 实际上是 database），返回 5078
- 6.0.1 时代 superset 没有这层 catalog 解析，原 URI 直接 pass-through 给 starrocks driver，所以能跑

> StarRocks 有 "catalog → database → table" 三级模型。内置默认 catalog 叫 `default_catalog`，所有原生表都在它下面。你之前用 mysql client 直连不指定 catalog 时，StarRocks 默认就在 `default_catalog` 里查，所以看不到这层。

**确认你 StarRocks 集群的 catalog/database 结构**（用任意 mysql client）：

```bash
mysql -h <starrocks-fe-host> -P 9030 -u <user> -p<password> \
      -e "SHOW CATALOGS"
# 期望看到至少一行 default_catalog (Internal)

mysql -h <starrocks-fe-host> -P 9030 -u <user> -p<password> \
      -e "SHOW DATABASES FROM default_catalog"
# 这里能看到你的业务 database 名（例如 bluetti）
```

**修复**：在 Superset UI → Database Connections，把 StarRocks 连接的 URI 从

```
starrocks://<user>:<password>@<host>:<port>/<db>
```

改成

```
starrocks://<user>:<password>@<host>:<port>/<catalog>.<db>
```

对你的场景就是：

```
starrocks://agi:Abcd.123@192.168.40.180:19030/default_catalog.bluetti
```

Test Connection → Save → 浏览器强制刷新即可。

**如果你还有连 StarRocks 外部 catalog（如 Paimon、Iceberg、Hive）的连接**：写法一样，把 catalog 名换掉，例如 `starrocks://.../paimon.<paimon_db>`。

**附带可能看到的警告**（无害，可忽略）：

```
Failed to get run_mode: (pymysql.err.OperationalError) (5203, 'Access denied;
you need (at least one of) the OPERATE privilege(s) on SYSTEM ...
[SQL: ADMIN SHOW FRONTEND CONFIG LIKE 'run_mode']
```

这是 starrocks 1.3.3 方言初始化时执行的探测 SQL，如果你的 superset 连接用户只有 `read_only` 角色（推荐！），就会拿不到 OPERATE 权限。这只是**警告日志**，方言会优雅降级，不影响 SELECT/SHOW 等正常查询。

---

## 附录 A：单机一体方案（构建机即生产机）

如果你**只有一台机器**（生产机本身能装 Node 22），并且不想跨机器分发 wheel，可以省略「打 wheel + scp」环节，直接在生产机上跑完所有步骤：

```bash
# 生产机上一气呵成
sudo apt-get install -y \
    build-essential libssl-dev libffi-dev libsasl2-dev libldap2-dev \
    default-libmysqlclient-dev pkg-config libpq-dev \
    python3.10-dev python3.10-venv python3-pip git curl

# Node 22 (一次性)
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
nvm install 22 && nvm alias default 22

# 拉代码 + build + 装
sudo mkdir -p /opt/superset && sudo chown $USER:$USER /opt/superset
git clone --depth=1 https://github.com/250715122/superset.git /opt/superset
cd /opt/superset/superset-frontend
npm ci --no-audit --no-fund
NODE_OPTIONS="--max-old-space-size=4096" npm run build
rm -rf node_modules                                # 装完释放磁盘

cd /opt/superset
python3.10 -m venv venv
source venv/bin/activate
pip install --upgrade 'pip==25.2' wheel setuptools
pip install .                                      # 注意: 末尾这个点!
pip install mysqlclient gunicorn gevent
```

然后跳到第九节起继续（配置 / 初始化 / systemd）。

**单机一体的代价**：

- 生产机要装 Node 22（增加 ~500 MB 与维护成本）
- 升级时要重跑 `npm run build`（每次 ~15 分钟）
- 多机部署时每台机器要重复以上工作

只在只有一台机器、且确认不会变多时用。

---

## 附录 B：用 GitHub Actions 自动出 wheel（高级）

如果你已经能熟练用构建机出 wheel，下一步是把构建机替换为 GitHub Actions——push tag 自动出 wheel 上传到 GitHub Releases，云服务器直接 `wget` 拉。

在 fork 仓库 `.github/workflows/release-wheel.yml`：

```yaml
name: Build & Release Wheel

on:
  push:
    tags:
      - 'v*'

jobs:
  build-wheel:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - uses: actions/setup-python@v5
        with:
          python-version: '3.10'

      - name: Build frontend
        working-directory: superset-frontend
        run: |
          npm ci --no-audit --no-fund
          NODE_OPTIONS="--max-old-space-size=4096" npm run build

      - name: Build wheel
        run: |
          pip install --upgrade 'pip==25.2' build
          python -m build --wheel

      - name: Upload to release
        uses: softprops/action-gh-release@v2
        with:
          files: dist/*.whl
```

打 tag 即触发：

```bash
git tag -a v6.1.0-fork-1 -m "first internal release"
git push origin v6.1.0-fork-1
```

云服务器升级时：

```bash
WHEEL_URL=$(curl -s https://api.github.com/repos/250715122/superset/releases/latest \
    | jq -r '.assets[] | select(.name | endswith(".whl")) | .browser_download_url')
wget "$WHEEL_URL" -O /tmp/superset.whl

source /opt/superset/venv/bin/activate
pip install /tmp/superset.whl --force-reinstall --no-deps
sudo systemctl restart superset
```

---

## 附录 C：完整目录布局

### 构建机

```
/opt/superset-build/
├── .git/                              # fork 浅克隆
├── superset/                          # 源码
├── superset-frontend/                 # 前端源码 + build 配置 (node_modules 临时)
├── build-venv/                        # 构建专用 venv (含 build 工具)
└── dist/
    ├── apache_superset-X.Y.Z-py3-none-any.whl    # 关键产物
    └── BUILD_COMMIT.txt                          # 对应的 git commit
```

### 云服务器

```
/opt/superset/
├── .deployed_commit                   # 当前部署对应的构建 commit
├── superset_config.py                 # 生产配置 (chmod 600)
└── venv/                              # 运行环境
    └── lib/python3.10/site-packages/
        └── superset/                  # 装好的 superset 包
            ├── __init__.py
            └── static/assets/         # 前端 build 产物 (已打进 wheel)
/etc/systemd/system/
├── superset.service                   # 主服务
├── superset-worker.service            # 可选: Celery worker
└── superset-beat.service              # 可选: Celery beat
/etc/nginx/sites-available/
└── superset.conf                      # 可选: HTTPS 反代
/var/log/superset/
├── access.log
└── error.log
/opt/backup/                           # 升级前备份
├── db_2026-05-18-1700.sql.gz
└── venv_2026-05-18-1700/
```

云服务器上**没有** git 仓库、源码目录、node_modules——全部已经预编译进 wheel。

---

## 附录 D：环境变量速查

| 变量 | 值 | 何时需要 |
|---|---|---|
| `SUPERSET_CONFIG_PATH` | `/opt/superset/superset_config.py` | 跑任何 `superset ...` 命令前 |
| `FLASK_APP` | `superset.app:create_app` | 跑 `superset db ...` 等命令前 |
| `PYTHONUNBUFFERED` | `1` | systemd 下让 print 立即冲刷到日志 |

systemd unit 已通过 `Environment=` 注入，服务运行时不依赖 shell 环境。手动跑命令时记得：

```bash
source /opt/superset/venv/bin/activate
export SUPERSET_CONFIG_PATH=/opt/superset/superset_config.py
export FLASK_APP=superset.app:create_app
```

---

## 附录 E：与开发模式的主要差异

| 维度 | 开发（[development-setup.zh.md](development-setup.zh.md)） | 生产（本文档） |
|---|---|---|
| 安装方式 | `pip install -e .`（editable，本机有源码） | `pip install xxx.whl`（wheel，零源码） |
| 安装位置 | 构建机一台 | **构建机 + 云端两侧分工** |
| 前端 | `npm run dev-server`（HMR，9000 端口） | 构建机 `npm run build` 一次，wheel 自带产物 |
| Flask | `flask run --reload --debugger` | `gunicorn -k gevent` |
| 进程 | 手动启动两个终端 | systemd 托管 |
| 配置文件 | `superset_config_local.py`，弱密钥 | `superset_config.py`，强 `SECRET_KEY` + Talisman |
| `DEBUG` | `True` | `False` |
| 反代 | 不需要 | nginx + HTTPS |
| 改代码后 | 自动 reload，秒级生效 | 构建机重出 wheel → scp → reinstall → restart |
| 修源码 | 直接编辑 `/opt/superset6.1/superset/*.py` | 在构建机的 git 仓库改，**云上没有源码** |

---

## 附录 F：常见误区

### F.1 "我能不能直接 `pip install apache-superset` 装我 fork 的代码？"

**不能**。`pip install apache-superset` 从 **PyPI** 拉的是 Apache 团队官方发布的 wheel，里面没有你的修改。`apache-superset` 这个包名也已被 ASF 注册，你不能往同一个名字上推自己的版本。要让"一行装好"成立，必须自己当一回 release manager（即本文整套流程）。

### F.2 "为啥不能在云服务器上 `git clone + pip install .`？"

**可以**——这就是附录 A 的单机一体方案。代价是云服务器必须装 Node 22、git、源码（约 ~5 GB 磁盘），且每次升级要重跑 npm build。本文主流程把这些都挪到构建机，云机最干净。

### F.3 "pip install . 和 pip install xxx.whl 有什么区别？"

`pip install .` 内部其实**也会临时打一个 wheel 再装**，区别只在临时 wheel 不会输出到 `dist/`、装完即扔。`python -m build --wheel` 是把这个临时 wheel 保留下来，便于跨机器分发。

### F.4 "构建机能不能用 Mac / Windows？"

- **Mac**：能（Apple Silicon 也能），出的 wheel 是 `py3-none-any.whl`（纯 Python），可跑在 x86 Linux 上
- **Windows 原生**：**不推荐**——Superset 前端 build 在 Windows 上有路径分隔符、symlink、IO 慢等多个已知坑
- **Windows + WSL2**：可（WSL2 本质是 Linux）

### F.5 "构建机和云服务器一定要同发行版吗？"

不强制，但**强烈建议**——`mysqlclient`、`psycopg2` 这些扩展是在云上装的，受云上 OS 的 glibc 影响；wheel 本体是纯 Python，与发行版无关。两边都 Ubuntu 22.04 是最稳的选择。

---

## 附录 G：把本地修复 PR 回 apache 上游

本仓库（fork）相比 apache 上游领先一个 commit `e165b01`：把 `np.product` 替换为 `np.prod`，让代码兼容 numpy 2.x。这一行修复**对 apache/superset 项目本身**也有价值——上游 master 和 6.1.0 tag 都仍带有 `np.product`，只是被 `requirements/base.txt` 的 `numpy==1.26.4` 锁定兜底而未爆出。把它合回上游，可以让其他像我们一样自建 wheel + 不带 constraints 部署的下游都受益。

### G.1 操作步骤

```bash
# 1. 先确保 fork 配了 apache 上游 remote
git remote -v
# 若没看到 upstream 行，加上：
git remote add upstream https://github.com/apache/superset.git
git fetch upstream master

# 2. 基于 apache master 开一个干净的分支，只 cherry-pick 那一行修复
git checkout -b fix-numpy-product upstream/master
git cherry-pick e165b01

# 3. push 到你 fork
git push origin fix-numpy-product
```

### G.2 PR 描述模板

去 [github.com/apache/superset](https://github.com/apache/superset/compare) 开 PR：

```
title: fix(utils): replace np.product (removed in numpy 2.0) with np.prod

body:
### SUMMARY

`np.product` has been a deprecated alias for `np.prod` since numpy 1.x
and was removed entirely in numpy 2.0. The current
`numpy>1.23.5, <2.3` constraint in pyproject.toml allows numpy 2.x,
but superset/utils/pandas_postprocessing/utils.py:49 still references
`np.product`, breaking any environment installed via wheel without
also pinning `requirements/base.txt`.

`base.txt` does pin `numpy==1.26.4`, which masks this bug for users
following the official PyPI install workflow, but downstream wheel
consumers (anyone running `pip install <fork-wheel>` without `-c`)
hit it immediately:

    AttributeError: module 'numpy' has no attribute 'product'

Switch to `np.prod` (functionally identical, it has always been the
underlying implementation) so the code is forward compatible with
numpy 2.x.

### TESTING

`python -c "from superset.utils.pandas_postprocessing.utils import NUMPY_FUNCTIONS"`
should succeed under both numpy 1.26.x and numpy 2.x.
```

按 [.github/PULL_REQUEST_TEMPLATE.md](../../../.github/PULL_REQUEST_TEMPLATE.md) 的最新格式填表，按 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) 命名 PR 标题。

### G.3 同步上游

PR 合并后（或在等待期间），把上游 master 同步回你 fork：

```bash
git fetch upstream
git checkout master
git merge upstream/master         # 或 rebase
git push origin master
```

PR 合并后，你 fork 的修复 commit `e165b01` 会以 apache 上游的形式重新出现在 history 里。


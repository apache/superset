---
title: 在 Linux 上搭建 Superset 开发与调试环境（中文）
sidebar_position: 3
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

# 在 Linux 上搭建 Superset 开发与调试环境

本文档面向中文开发者，基于本 fork（apache/superset 的下游分支，~6.1）实战验证，给出一套在 Linux 服务器上**最易用、最易调试**的开发环境搭建步骤。

英文官方文档见 [development-setup.md](development-setup.md)；本文档作为中文补充，对在 Windows 主机 + Linux 虚拟机/远程服务器组合下的真实落地做了细化与避坑。

## 一、整体方案：混合模式（推荐）

> **核心思路**：Postgres 与 Redis 作为依赖跑在 docker 容器里；Flask 与 webpack dev-server 直接跑在 Linux 服务器的 Python venv / Node.js 中；Cursor 通过 Remote SSH 连接服务器进行编辑、断点调试。

```mermaid
flowchart LR
    subgraph win[Windows 本机]
        cursor[Cursor IDE Remote SSH]
        browser["浏览器 http://VM_IP:9000"]
    end
    subgraph linux["Linux 服务器 /opt/superset6.1"]
        code[Fork 源码]
        subgraph venv[Python venv 与 Node 进程]
            flask["Flask superset run<br/>8088 端口 reload+debug"]
            web["npm run dev-server<br/>9000 端口 HMR"]
        end
        subgraph dockerdeps[docker compose 仅依赖]
            pg["Postgres 17<br/>127.0.0.1:5433"]
            redis["Redis 7<br/>127.0.0.1:6380"]
        end
    end
    cursor -- SSH 编辑/调试 --> code
    code --> flask
    code --> web
    flask --> pg
    flask --> redis
    web -- 代理后端 API --> flask
    browser --> web
```

**为什么这种组合最舒服**：

- 调试体验等同本地：Cursor Remote SSH 接入后，在 Python 文件行号点击即可打断点，无需 docker exec / debugpy attach 附加流程
- 改 Python / TypeScript 代码：venv 与 Node 进程直接运行宿主机文件，inotify 文件监听零损耗，热重载稳定
- 依赖一键拉起：Postgres、Redis 用 docker compose 起，免去 `apt install postgresql` 之后的端口、权限、初始化配置
- 不污染主仓库：依赖端口、本地配置全部走 `docker/.env-local` + `superset_config_local.py`，都在 `.gitignore` 之内

> 如果你只想运行起来看看、不打算改代码，可直接跳到文末 [备选方案：纯 docker compose](#备选方案纯-docker-compose-一键启动)。

---

## 二、前置条件

### Linux 服务器

| 项 | 最低要求 | 验证命令 |
|---|---|---|
| 操作系统 | Ubuntu 22.04 LTS 或更高 / Debian 12 / CentOS Stream 9+ | `lsb_release -a` |
| 磁盘 | 空闲 ≥ 15 GB（venv 1G + node_modules 3G + git 200M + docker 镜像/卷 1G + 预留） | `df -h /opt` |
| 内存 | ≥ 4 GB（首次 webpack 编译峰值约 2.5 GB） | `free -h` |
| sudo | 当前用户可 sudo（推荐免密） | `sudo -n whoami` |
| docker 用户组 | 当前用户在 docker 组内 | `groups` |

### Windows 本机

- 已安装 [Cursor IDE](https://cursor.com/) 或 VSCode，并安装 **Remote - SSH** 扩展
- 能通过 SSH 直连虚拟机（推荐配置免密：`ssh-copy-id` 或在 `~/.ssh/config` 写入 IdentityFile）

### 网络

- 服务器到 `github.com`、`registry.npmjs.org`、`pypi.org`、`hub.docker.com` 可正常访问

---

## 三、安装基础工具链

> 以下命令均在 **Linux 服务器**上执行，未特别说明的默认用普通账户（如 `gt`），需要 root 时用 `sudo`。

### 1. 系统编译依赖（一次性）

```bash
sudo apt-get update
sudo apt-get install -y \
    build-essential libssl-dev libffi-dev \
    libsasl2-dev libldap2-dev libpq-dev \
    default-libmysqlclient-dev pkg-config \
    python3.10-dev python3.10-venv python3-pip \
    git curl
```

如果 `apt` 被 `unattended-upgrades` 占用锁，会报 `Could not get lock /var/lib/dpkg/lock-frontend`。等几分钟它跑完，或临时停掉：

```bash
sudo systemctl stop unattended-upgrades
# 装完之后再启回
sudo systemctl start unattended-upgrades
```

### 2. Python（项目支持 3.10/3.11/3.12，Ubuntu 22.04 自带 3.10 即可）

```bash
python3.10 --version  # 应输出 Python 3.10.x
```

如需 3.11，参考 [deadsnakes PPA](https://launchpad.net/~deadsnakes/+archive/ubuntu/ppa)。

### 3. Node.js 22 + npm 10（项目 `package.json` 强制 `^22.22.0`）

强烈建议用 [nvm](https://github.com/nvm-sh/nvm) 而不是 `apt install nodejs`：

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# 让当前 shell 立即可用（新开终端会自动 source）
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

nvm install 22
nvm alias default 22
node -v   # v22.22.x
npm -v    # 10.9.x
```

### 4. Docker & docker compose

```bash
docker --version          # 27.x 或更高
docker compose version    # v5.x 或更高
docker info | head -5     # 验证当前用户已加入 docker 组
```

如果 `docker info` 报权限错误：

```bash
sudo usermod -aG docker $USER
newgrp docker
```

---

## 四、克隆 Fork 仓库

```bash
sudo mkdir -p /opt/superset6.1
sudo chown -R $USER:$USER /opt/superset6.1
cd /opt/superset6.1

# 浅克隆（仅最新一层 commit，约 145 MB，耗时 2-5 分钟）
git clone --depth=1 --single-branch --branch=master \
    https://github.com/250715122/superset.git .

# 添加上游，便于后续 sync
git remote add upstream https://github.com/apache/superset.git

git log --oneline -1   # 应显示 HEAD commit
```

> **为什么浅克隆**：Superset 主仓库提交历史巨大（5 万+ commit，全量 clone 1 GB+ 且常因网络中断失败）。开发环境用不到完整历史；将来要发 PR 时再 `git fetch --unshallow` 即可恢复。

---

## 五、启动依赖容器（Postgres + Redis）

主仓默认 Postgres 用 5432、Redis 用 6379，**这两个端口在你机器上很可能被占用**（系统自带 PostgreSQL、之前装过的 Redis 等）。先排查并通过 `docker/.env-local` 偏移端口：

```bash
sudo ss -ltnp | grep -E ':(5432|6379|8088|9000)\s'
```

若 5432 / 6379 被占用，写一个本地覆盖文件（已被 `.gitignore`）：

```bash
cat > /opt/superset6.1/docker/.env-local <<'EOF'
COMPOSE_PROJECT_NAME=superset61
DATABASE_PORT=5433
REDIS_PORT=6380
EOF
```

启动两个依赖容器：

```bash
cd /opt/superset6.1
docker compose \
    --env-file docker/.env \
    --env-file docker/.env-local \
    up -d db redis

docker compose --env-file docker/.env --env-file docker/.env-local ps
```

预期输出：

```
NAME                 IMAGE         SERVICE   STATUS         PORTS
superset61-db-1      postgres:17   db        Up X seconds   127.0.0.1:5433->5432/tcp
superset61-redis-1   redis:7       redis     Up X seconds   127.0.0.1:6380->6379/tcp
```

> **重要**：`--env-file` 必须显式指定，否则 docker compose 不会读 `docker/.env-local`（仅服务级 env_file 自动加载，端口映射的 `${DATABASE_PORT}` 是在 compose 解析阶段展开，需要 shell 或 --env-file 提供）。

验证依赖容器连通性：

```bash
# Postgres
docker exec superset61-db-1 psql -U superset -d superset -c '\dt'

# Redis
docker exec superset61-redis-1 redis-cli ping
# 期望返回 PONG
```

---

## 六、Python venv 与依赖安装

```bash
cd /opt/superset6.1
python3.10 -m venv venv
source venv/bin/activate

# 升级 pip 到稳定版（pip 26.x 当前存在 certifi 路径 bug，避坑）
pip install --upgrade 'pip==25.2' wheel setuptools

# 安装所有开发依赖（约 5-10 分钟，会编译 python-ldap / pyhive / mysqlclient 等本地扩展）
pip install -r requirements/development.txt
```

> 当 `pip install` 报 `Could not find a suitable TLS CA certificate bundle, invalid path: .../certifi/cacert.pem`，说明命中了 pip 26.x 的预发布 bug。删除 venv 重建并固定 `pip==25.2` 即可。

完成后，本仓库已通过 `pyproject.toml` 的 `pip install -e .` 自动安装为 editable 模式（看 `pip list | grep apache-superset` 应有 `apache_superset 0.0.0.dev0`）。

---

## 七、本地配置覆盖文件

在仓库根（**注意不是 `superset/` 子目录**）创建 `superset_config_local.py`：

```python
# /opt/superset6.1/superset_config_local.py
"""Local development override for the hybrid dev setup."""

SQLALCHEMY_DATABASE_URI = "postgresql://superset:superset@127.0.0.1:5433/superset"

REDIS_HOST = "127.0.0.1"
REDIS_PORT = 6380

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


class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/1"
    worker_prefetch_multiplier = 1
    task_acks_late = False


CELERY_CONFIG = CeleryConfig

SECRET_KEY = "DEV-ONLY-CHANGE-ME-1234567890abcdefghijklmnop"
WTF_CSRF_ENABLED = False
TALISMAN_ENABLED = False

FEATURE_FLAGS = {
    "ALERT_REPORTS": True,
    "DASHBOARD_RBAC": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
}
```

把它接入运行时（同时建议写进 `~/.bashrc`，下次 ssh 就生效）：

```bash
export SUPERSET_CONFIG_PATH=/opt/superset6.1/superset_config_local.py
export FLASK_APP=superset.app:create_app
export FLASK_DEBUG=true
```

`SECRET_KEY` 必须设置；如果暴露到公网，请务必换成 `openssl rand -base64 42` 的随机串。

---

## 八、初始化元数据库

```bash
cd /opt/superset6.1
source venv/bin/activate
export SUPERSET_CONFIG_PATH=/opt/superset6.1/superset_config_local.py
export FLASK_APP=superset.app:create_app

# 1. 升级元数据 schema（首次会跑全部 alembic migration，约 15-30 秒）
superset db upgrade

# 2. 创建管理员
superset fab create-admin \
    --username admin \
    --firstname Admin \
    --lastname User \
    --email admin@superset.io \
    --password admin

# 3. 同步默认角色/权限
superset init

# 4.（可选）加载官方示例数据，耗时 5-15 分钟，会写入大量样例 dashboard
# 想完整体验 BI 功能就跑；只想验证流程可跳过
superset load-examples
```

完成后 Postgres 里应已有 `ab_user`、`slices`、`dashboards` 等 50+ 张表：

```bash
docker exec superset61-db-1 psql -U superset -d superset -c '\dt' | head -20
```

---

## 九、安装前端依赖

```bash
cd /opt/superset6.1/superset-frontend
nvm use 22       # 确保 Node 22
npm ci --no-audit --no-fund --prefer-offline
```

预期：3800+ 包，约 5-10 分钟（首次）。完成后 `node_modules` 约 3 GB。

> 如果 `npm ci` 卡在某个 git 协议依赖，多半是网络。可以配 npm 镜像或重跑。

---

## 十、启动开发服务

### 方式 A：命令行临时启动（验证用）

需要开两个终端：

**终端 1：Flask 后端**

```bash
cd /opt/superset6.1 && source venv/bin/activate
export SUPERSET_CONFIG_PATH=/opt/superset6.1/superset_config_local.py
export FLASK_APP=superset.app:create_app
export FLASK_DEBUG=true

superset run -p 8088 --host=0.0.0.0 --with-threads --reload --debugger
```

启动成功的标志（约 5-10 秒）：

```
 * Serving Flask app 'superset.app:create_app'
 * Debug mode: on
 * Running on http://127.0.0.1:8088
 * Running on http://<VM_IP>:8088
 * Restarting with watchdog (inotify)
```

**终端 2：webpack dev-server**

```bash
cd /opt/superset6.1/superset-frontend
nvm use 22
npm run dev-server -- --host=0.0.0.0
```

首次编译约 2-3 分钟（13000+ modules）。完成的标志：

```
webpack X.X.X compiled successfully in NNNNN ms
```

### 方式 B：Cursor / VSCode 断点调试（推荐日常用）

详见下一节。

---

## 十一、Cursor Remote SSH + 断点调试

### 1. Cursor 配置 Remote SSH

1. 安装 **Remote - SSH** 扩展（Cursor 与 VSCode 同款）
2. 命令面板（Ctrl+Shift+P）→ `Remote-SSH: Connect to Host`
3. 输入 `gt@192.168.56.101`，或在 `~/.ssh/config` 配置：

   ```
   Host superset-vm
     HostName 192.168.56.101
     User gt
     IdentityFile ~/.ssh/id_ed25519
   ```

4. 连上后，`File → Open Folder` 打开 `/opt/superset6.1`
5. 安装远程 VM 端的 Cursor 推荐扩展：
   - Python (`ms-python.python`)
   - Pylance (`ms-python.vscode-pylance`)
   - Ruff (`charliermarsh.ruff`)
   - ESLint (`dbaeumer.vscode-eslint`)
   - Prettier (`esbenp.prettier-vscode`)
6. 命令面板 → `Python: Select Interpreter` → 选 `/opt/superset6.1/venv/bin/python`

### 2. 配置 `.vscode/launch.json`

在 Linux 仓库根创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Superset: Flask Debug",
      "type": "debugpy",
      "request": "launch",
      "module": "flask",
      "cwd": "${workspaceFolder}",
      "env": {
        "FLASK_APP": "superset.app:create_app",
        "FLASK_DEBUG": "1",
        "SUPERSET_ENV": "development",
        "SUPERSET_CONFIG_PATH": "${workspaceFolder}/superset_config_local.py"
      },
      "args": [
        "run", "-p", "8088",
        "--host", "0.0.0.0",
        "--with-threads",
        "--no-reload",
        "--no-debugger"
      ],
      "jinja": true,
      "justMyCode": false,
      "console": "integratedTerminal"
    }
  ]
}
```

> **关键点**：`--no-reload` 是有意为之。Flask 的自动 reload 会 fork 子进程，导致断点附加在父进程上失效；让 Cursor 自己接管热重载（修改代码后手动 F5 重启或用 debugpy 的 hot-reload 即可）。如果你坚持要 reload，把 `--no-reload` 换成 `--reload`，但代价是断点偶发不命中（需要先改文件触发重新加载）。

### 3. 启动调试

1. 在 Cursor 中按 `F5` 启动 `Superset: Flask Debug`
2. 在任意 Python 文件（如 `superset/views/core.py` 中的某个 view 函数）点击行号，**蓝色断点出现**
3. 浏览器访问对应 URL（例如登录后打开任意页面），**Cursor 自动定位到断点行**，左侧变量面板可查看上下文

### 4. 前端独立终端跑 dev-server

dev-server 不需要调试器；直接在 Cursor 的集成终端跑：

```bash
cd superset-frontend
nvm use 22
npm run dev-server -- --host=0.0.0.0
```

修改 `*.tsx` / `*.ts` 文件保存后，浏览器自动 HMR 刷新。

---

## 十二、访问与端口转发

### 1. 直接访问（host-only 网络）

如果 VM 用 VirtualBox host-only 或桥接网络，Windows 主机直接：

| URL | 用途 |
|---|---|
| `http://VM_IP:9000` | **主入口**（webpack dev-server，前端 HMR + 后端 API 代理） |
| `http://VM_IP:8088` | Flask 后端（一般用于直接调 API / 看 `/health`） |

登录账号：`admin / admin`

### 2. SSH 端口转发（NAT 网络或要走加密通道）

Cursor 的 Remote SSH 默认自动转发常用端口（看右下角 PORTS 面板）。也可手动转发：

```bash
# 在 Windows PowerShell 上跑
ssh -L 9000:127.0.0.1:9000 -L 8088:127.0.0.1:8088 gt@192.168.56.101
```

然后访问 `http://localhost:9000`。

### 3. 验证健康

```bash
curl -i http://VM_IP:8088/health     # HTTP/1.1 200 OK
curl -i http://VM_IP:9000/login/     # HTTP/1.1 200 OK
```

---

## 十三、日常开发循环

| 动作 | 做什么 |
|---|---|
| **首次启动 / 重启 VM** | `cd /opt/superset6.1 && docker compose --env-file docker/.env --env-file docker/.env-local up -d db redis` |
| **写 Python，要调试** | Cursor F5 启动 Flask Debug 配置，行号打断点 |
| **写 TypeScript / 改 UI** | `cd superset-frontend && npm run dev-server -- --host=0.0.0.0`（保持运行） |
| **新加 Python 依赖** | 改 `requirements/*.in` → `./scripts/uv-pip-compile.sh` → `pip install -r requirements/development.txt` |
| **新加前端依赖** | `cd superset-frontend && npm install <pkg>` |
| **跑 Python 测试** | `pytest tests/unit_tests/...` |
| **跑前端测试** | `cd superset-frontend && npm test -- path/to/file.test.tsx` |
| **pre-commit 校验** | `git add . && pre-commit run`（仅检查暂存文件） |
| **停止环境** | Ctrl+C 停 dev-server 和 Flask；`docker compose --env-file docker/.env --env-file docker/.env-local stop` |
| **彻底清理** | `docker compose --env-file docker/.env --env-file docker/.env-local down -v`（**注意 `-v` 会删卷，元数据丢失**） |

---

## 十四、常见问题排查

### Q1. `dpkg` 锁报错：`Could not get lock /var/lib/dpkg/lock-frontend`

Ubuntu 自动升级（unattended-upgrades）在跑。等 5-10 分钟，或：

```bash
ps -ef | grep unattended-upgr
sudo systemctl stop unattended-upgrades
# 装完再 start
```

### Q2. 端口已占用：`bind: address already in use`

```bash
sudo ss -ltnp | grep -E ':(5432|6379|8088|9000)\s'
```

调整 `docker/.env-local` 的 `DATABASE_PORT` / `REDIS_PORT`，或停掉占用端口的服务，并同步更新 `superset_config_local.py` 的对应端口。

### Q3. `pip install` 报 `certifi/cacert.pem` 找不到

pip 26.x 预发布版 bug，降级：

```bash
rm -rf venv
python3.10 -m venv venv
source venv/bin/activate
pip install --upgrade 'pip==25.2' wheel setuptools
pip install -r requirements/development.txt
```

### Q4. `superset db upgrade` 卡很久 / 报连接失败

确认 Postgres 容器在跑、`SUPERSET_CONFIG_PATH` 已 export、`superset_config_local.py` 的 URI 端口与 `docker compose ps` 显示的宿主端口一致。

```bash
docker compose --env-file docker/.env --env-file docker/.env-local ps
docker exec superset61-db-1 pg_isready -U superset
echo $SUPERSET_CONFIG_PATH
```

### Q5. webpack 编译卡在 95% emit 不动

通常是首次冷启动，硬盘 IO 慢。耐心等到出现 `compiled successfully`。如果超过 5 分钟没动静，看 `free -h`，内存可能不够（峰值 ~2.5 GB）：

```bash
free -h
# 不够就给 VM 加内存到 6-8 GB
```

### Q6. Cursor Remote SSH 断点不命中

- 确认 `launch.json` 的 `--no-reload`（见第 11 节）已加
- `justMyCode` 设为 `false`，否则三方库断点不停
- 解释器选错？命令面板 → `Python: Select Interpreter` → `/opt/superset6.1/venv/bin/python`

### Q7. 前端代码改了但浏览器不更新

- 确认 webpack dev-server 日志里出现 `[HMR] Updated modules`
- 浏览器关闭 Service Worker / 强刷 Ctrl+F5
- 检查 webpack 输出窗口是否在每次保存后重新编译；如果不重新编译，说明 inotify 失效（多半是把代码放在 vboxsf 共享文件夹里了，迁移到 Linux 原生目录如 `/opt/superset6.1`）

### Q8. `npm ci` 卡住或失败

```bash
# 清理后重试
rm -rf node_modules package-lock.json
npm ci --no-audit --no-fund --loglevel=verbose
```

国内网络可加 `npm config set registry https://registry.npmmirror.com`。

### Q9. flask reload 失效

确认 `superset_config_local.py`、`superset/` 目录在 Linux 本地文件系统上（不是 NFS / 共享文件夹）。NFS / vboxsf 不支持 inotify。

### Q10. VM 重启后 docker 容器没起

```bash
# 容器虽然 restart: unless-stopped，但如果你执行过 docker compose down 它就不会自动起
cd /opt/superset6.1
docker compose --env-file docker/.env --env-file docker/.env-local up -d db redis
```

---

## 备选方案：纯 docker compose 一键启动

如果你**只想运行起来**、不打算改代码、对断点调试无需求，最快路径是项目根目录直接：

```bash
cd /opt/superset6.1
docker compose up --build
```

会启动：Postgres + Redis + Flask + webpack dev-server + Celery worker + Celery beat + WebSocket + Nginx 全套。

默认入口：`http://VM_IP:9000`（开发模式）或 `http://VM_IP:80`（nginx）。账号 `admin/admin`。

**何时选这个方案**：

- 集成验证完整功能（含 Celery 异步任务、Alert/Report）
- 不打算用 Cursor 断点
- 资源充裕（≥ 8 GB 内存）

**断点调试**：需手动 `docker exec superset_app bash` 进容器，装 `debugpy`，attach 到 Flask 主进程，详见英文官方文档 [development-setup.md](development-setup.md) 第 851-955 行。

---

## 附录 A：本仓库的本地配置文件清单

以下文件是开发环境特有的、**已加入 `.gitignore`**，不会提交到 fork：

| 路径 | 作用 |
|---|---|
| `superset_config_local.py` | Python 配置覆盖（本文第七节） |
| `docker/.env-local` | docker compose 端口覆盖（本文第五节） |
| `docker/pythonpath_dev/superset_config_docker.py` | docker compose 内部覆盖（仅用方式 A 时需要） |
| `.vscode/launch.json` | Cursor 调试配置（本文第十一节） |
| `venv/` | Python 虚拟环境 |
| `superset-frontend/node_modules/` | 前端依赖 |

## 附录 B：环境变量速查

| 变量 | 值 | 何时需要 |
|---|---|---|
| `SUPERSET_CONFIG_PATH` | `/opt/superset6.1/superset_config_local.py` | 跑任何 `superset ...` 或 `flask run` 之前 |
| `FLASK_APP` | `superset.app:create_app` | 跑 `flask run`（仓库 `.flaskenv` 已含） |
| `FLASK_DEBUG` | `true` | 开发模式（仓库 `.flaskenv` 已含） |
| `PYTHONDONTWRITEBYTECODE` | `1` | 可选，避免源代码目录生成 `__pycache__` |

把它们加进 `~/.bashrc` 末尾，或者用 [direnv](https://direnv.net/) 配 `.envrc`，每次 cd 进仓库自动 export。

## 附录 C：备份与回滚

- **代码**：定期 `git push` 到 GitHub fork，VM 损坏可在新机器秒级恢复
- **元数据库**：`docker exec superset61-db-1 pg_dump -U superset superset > backup.sql`
- **完全重置**：`docker compose --env-file docker/.env --env-file docker/.env-local down -v` 删除卷后，重新走第八节的初始化命令

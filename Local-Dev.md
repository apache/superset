# Superset 本地开发环境搭建指南

## 环境要求

- **Python**: 3.9, 3.10, 3.11 或 3.12
- **Node.js**: 20.18.1+ (当前使用 v22.14.0)
- **npm**: 10.8.1+
- **Git**: 用于克隆代码仓库
- **操作系统**: Windows 10/11, macOS, Linux

**注意**: 虽然官方文档推荐 Python 3.9-3.11，但 Python 3.12 也可以正常工作。

## 检查环境

### 检查 Python 版本

```bash
python --version
# 或
python3 --version
```

期望输出: `Python 3.9.x`, `3.10.x` 或 `3.11.x`

### 检查 Node.js 和 npm 版本

```bash
node --version
npm --version
```

期望输出:
- Node.js: `v20.18.1` 或更高
- npm: `10.8.1` 或更高

### 检查 Git 版本

```bash
git --version
```

期望输出: `git version 2.x.x`

## 项目结构

```
superset/
├── superset/              # Python 后端代码
├── superset-frontend/    # TypeScript/React 前端代码
├── superset_config.py      # 本地配置文件
├── requirements/          # Python 依赖文件
├── setup.py              # Python 包配置
└── superset.db          # SQLite 数据库文件（初始化后生成）
```

## 完整安装步骤

### 步骤 1: 克隆代码仓库

```bash
git clone https://github.com/apache/superset.git
cd superset
```

### 步骤 2: 创建 Python 虚拟环境

```bash
# Windows PowerShell
python -m venv venv

# macOS/Linux
python3 -m venv venv
```

### 步骤 3: 激活虚拟环境

```bash
# Windows PowerShell
.\venv\Scripts\Activate.ps1

# Windows CMD
venv\Scripts\activate.bat

# macOS/Linux
source venv/bin/activate
```

激活成功后，命令行提示符会显示 `(venv)` 前缀。

### 步骤 4: 升级 pip

```bash
pip install --upgrade pip setuptools wheel
```

### 步骤 5: 安装后端依赖

```bash
# 安装基础依赖
pip install -e .

# 安装开发依赖
pip install -r requirements/development.txt
```

**注意**: 安装过程可能需要 5-10 分钟，请耐心等待。

### 步骤 6: 创建配置文件

创建 `superset_config.py` 文件：

```python
import os

# 数据库配置 - 使用 SQLite（开发环境）
SQLALCHEMY_DATABASE_URI = "sqlite:///d:/workspace/superset-github/superset/superset.db"

# 缓存配置 - 使用 SimpleCache（无需 Redis）
CACHE_CONFIG = {
    'CACHE_TYPE': 'SimpleCache',
    'CACHE_DEFAULT_TIMEOUT': 300,
    'CACHE_KEY_PREFIX': 'superset_cache_',
    'CACHE_THRESHOLD': 1000
}

# 禁用压缩 - 避免开发环境中的编码问题
COMPRESS_REGISTER = False

# CORS 配置 - 允许前端开发服务器访问
ENABLE_CORS = True
CORS_OPTIONS = {
    'origins': [
        'http://localhost:9000',
        'http://127.0.0.1:9000'
    ]
}

# 启用调试模式
DEBUG = True

# 密钥配置（生产环境请使用随机密钥）
SECRET_KEY = 'your-secret-key-here'

# 启用功能标志
FEATURE_FLAGS = {
    'ALERT_REPORTS': True,
    'DASHBOARD_CROSS_FILTERS': True,
    'ENABLE_TEMPLATE_PROCESSING': True,
    'EMBEDDABLE_CHARTS': True,
}

# 时区设置
SUPERSET_WEBSERVER_TIMEOUT = 60
SUPERSET_WORKERS = 4
```

**重要**: 将 `SQLALCHEMY_DATABASE_URI` 中的路径修改为你的实际项目路径。

### 步骤 7: 初始化数据库

```bash
# 升级数据库
superset db upgrade

# 创建管理员用户
superset fab create-admin --username admin --firstname Admin --lastname User --email admin@example.com --password admin

# 初始化权限和角色
superset init
```

**说明**:
- `superset db upgrade`: 创建和更新数据库表结构
- `superset fab create-admin`: 创建管理员账户（用户名: admin, 密码: admin）
- `superset init`: 初始化示例数据和权限

### 步骤 7.1: 加载示例数据（可选）

```bash
# 加载示例数据集和仪表板
superset load-examples
```

**说明**: 此命令会加载以下示例数据：
- San Francisco population polygons（人口多边形）
- Flights data（航班数据）
- BART lines（BART 线路）
- Misc Charts dashboard（杂项图表仪表板）
- DECK.gl demo（DECK.gl 演示）

**注意**: 加载过程可能需要几分钟，请耐心等待。加载完成后，登录 Superset 即可看到示例仪表板和图表。

### 步骤 8: 安装前端依赖

```bash
cd superset-frontend

# 安装依赖
npm install

# 返回项目根目录
cd ..
```

**注意**: 安装过程可能需要 5-15 分钟，请耐心等待。

### 步骤 10: 修改前端代理配置（可选，用于 Windows 兼容性）

编辑 `superset-frontend/webpack.proxy-config.js`，添加 simple-zstd 容错处理：

```javascript
// 在文件开头添加
let ZSTDDecompress;
try {
  ({ ZSTDDecompress } = require('simple-zstd'));
} catch (error) {
  console.warn('simple-zstd not available, zstd compression will not be supported');
  ZSTDDecompress = null;
}

// 在响应处理中确保 UTF-8 编码
response.setHeader('content-type', 'text/html; charset=utf-8');
```

### 步骤 11: 启动后端服务

```bash
# 在项目根目录执行（确保虚拟环境已激活）

# Windows 环境（推荐）：不使用 --reload 参数避免频繁重启
superset run -p 8088 --with-threads --debugger --debug

# macOS/Linux 环境：可以使用 --reload 参数
superset run -p 8088 --with-threads --reload --debugger --debug
```

**后端服务地址**: `http://localhost:8088`

**特性**:
- 调试模式：启用调试器
- 线程支持：支持多线程请求
- 自动重载（仅 macOS/Linux）：代码修改后自动重启

**注意**: Windows 环境中，使用 `--reload` 参数可能导致服务频繁重启。如果遇到此问题，请移除 `--reload` 参数。修改后端代码后需要手动重启服务（Ctrl + C 停止，然后重新运行启动命令）。

**验证后端服务**:
```bash
# 新开一个终端窗口
python -c "import requests; r = requests.get('http://localhost:8088/health'); print('Backend Status:', r.status_code)"
```

期望输出: `Backend Status: 200`

### 步骤 12: 启动前端开发服务器

```bash
# 在 superset-frontend 目录执行
cd superset-frontend
npm run dev-server
```

**前端服务地址**: `http://localhost:9000`

**特性**:
- 热模块替换（HMR）：代码修改后自动更新
- 代理后端请求：自动代理到 `http://localhost:8088`
- 开发模式：使用未压缩的源代码

**验证前端服务**:
```bash
# 新开一个终端窗口
python -c "import requests; r = requests.get('http://localhost:9000/'); print('Frontend Status:', r.status_code); print('Content-Type:', r.headers.get('Content-Type'))"
```

期望输出:
```
Frontend Status: 200
Content-Type: text/html; charset=utf-8
```

## 一键启动（Windows）

为了方便快速启动前后端服务，项目提供了启动脚本：

### 方式 1: PowerShell 脚本（推荐）

**启动所有服务**:

```bash
# 在 PowerShell 中执行
.\start-dev.ps1
```

**脚本功能**:
- 自动检查虚拟环境、配置文件和数据库
- 自动启动后端服务（后台运行）
- 自动检查后端服务健康状态
- 自动启动前端服务（后台运行）
- 自动检查前端服务状态
- 显示服务访问地址和登录凭据
- 按 Ctrl+C 可一键停止所有服务

**停止所有服务**:

```bash
# 在 PowerShell 中执行
.\stop-dev.ps1
```

**脚本功能**:
- 自动查找并停止后端 Python 进程
- 自动查找并停止前端 Node 进程
- 显示停止状态

### 方式 2: 批处理脚本

**启动所有服务**:

双击运行 `start-dev.bat` 脚本，或在命令行中执行：

```bash
start-dev.bat
```

**脚本功能**:
- 自动启动后端服务（在新窗口）
- 等待 15 秒让后端服务完全启动
- 自动启动前端服务（在新窗口）
- 显示服务访问地址和登录凭据

**注意**:
- 脚本会在两个独立窗口中运行后端和前端服务
- 关闭脚本窗口不会停止服务
- 需要手动关闭后端和前端服务窗口来停止服务

**停止所有服务**:

双击运行 `stop-dev.bat` 脚本，或在命令行中执行：

```bash
stop-dev.bat
```

**脚本功能**:
- 自动停止后端服务
- 自动停止前端服务
- 显示停止状态

## 访问方式

### 推荐方式（前端开发服务器）

```
URL: http://localhost:9000
```

**优势**:
- 支持热重载
- 前端代码修改实时生效
- 自动代理后端 API 请求

### 直接访问后端

```
URL: http://localhost:8088
```

**用途**:
- 测试后端 API
- 查看后端日志
- 调试后端问题

## 登录凭据

```
用户名: admin
密码: admin
```

## 验证清单

完成所有步骤后，请验证以下项目：

- [x] Python 3.9/3.10/3.11/3.12 已安装
- [x] Node.js 20.18.1+ 已安装
- [x] npm 10.8.1+ 已安装
- [x] 虚拟环境已创建并激活
- [x] 后端依赖已安装（apache-superset）
- [x] 前端依赖已安装（node_modules 存在）
- [x] superset_config.py 已创建并配置
- [x] 数据库已初始化（superset.db 存在）
- [x] 管理员用户已创建（admin/admin）
- [x] 示例数据已加载（可选）
- [x] 后端服务运行在 http://localhost:8088
- [x] 前端服务运行在 http://localhost:9000
- [x] 可以访问 http://localhost:9000
- [x] 可以登录到 Superset（admin/admin）
- [x] 页面显示正常（无乱码）
- [x] Content-Type 正确设置为 `text/html; charset=utf-8`

## 验证命令

### 验证后端服务

```bash
python -c "import requests; r = requests.get('http://localhost:8088/health'); print('Backend Status:', r.status_code)"
```

期望输出: `Backend Status: 200`

### 验证前端服务

```bash
python -c "import requests; r = requests.get('http://localhost:9000/'); print('Frontend Status:', r.status_code); print('Content-Type:', r.headers.get('Content-Type'))"
```

期望输出:
```
Frontend Status: 200
Content-Type: text/html; charset=utf-8
```

### 验证数据库文件

```bash
# Windows PowerShell
Test-Path superset.db

# macOS/Linux
ls -la superset.db
```

期望输出: `True` 或显示数据库文件信息

## 验证结果示例

### 环境检查

```bash
# Python 版本
python --version
# 输出: Python 3.12.1

# Node.js 版本
node --version
# 输出: v22.14.0

# npm 版本
npm --version
# 输出: 10.9.2
```

### 后端依赖安装

```bash
pip install -e .
# 输出: Successfully installed apache_superset-0.0.0.dev0
```

### 数据库初始化

```bash
superset db upgrade
# 输出: Migration scripts completed. Duration: 00:00:XX

superset fab create-admin --username admin --firstname Admin --lastname User --email admin@example.com --password admin
# 输出: Admin User admin created.

superset init
# 输出: Syncing role definition... Creating missing datasource permissions... Cleaning faulty perms
```

### 前端依赖安装

```bash
npm install
# 输出: added 4226 packages, and audited 4860 packages in Xm
```

### 服务启动

**后端服务**:
```bash
superset run -p 8088 --with-threads --debugger --debug
# 输出:
# * Running on http://127.0.0.1:8088
# * Debugger is active!
# * Debugger PIN: XXX-XXX-XXX
```

**前端服务**:
```bash
npm run dev-server
# 输出:
# [webpack-dev-server] Project is running at:
# [webpack-dev-server] Loopback: http://127.0.0.1:9000/
# webpack 5.104.1 compiled successfully in XXXX ms
```

## 常见问题

### 1. 页面乱码

**原因**: 浏览器缓存或字符集问题

**解决方案**:
- 强制刷新：`Ctrl + Shift + R`（Windows/Linux）或 `Cmd + Shift + R`（macOS）
- 清除缓存：`Ctrl + Shift + Delete`（Windows/Linux）或 `Cmd + Shift + Delete`（macOS）
- 使用无痕模式访问
- 检查开发者工具中的 `Content-Type` 响应头

### 2. simple-zstd 错误

**原因**: Windows 上缺少 zstd 二进制文件

**解决方案**: 已在 webpack.proxy-config.js 中添加容错处理，不影响正常使用。

### 3. 数据库连接错误

**原因**: PostgreSQL 未运行或配置错误

**解决方案**: 使用 SQLite 配置（已在 superset_config.py 中配置），无需外部数据库。

### 4. npm 依赖安装失败

**原因**: 镜像源问题或网络问题

**解决方案**:
```bash
# 使用官方 npm 镜像源
npm config set registry https://registry.npmjs.org/

# 清除缓存
npm cache clean --force

# 重新安装
npm install
```

### 5. pip 安装依赖失败

**原因**: 网络问题或依赖冲突

**解决方案**:
```bash
# 升级 pip
pip install --upgrade pip

# 使用国内镜像源（可选）
pip install -e . -i https://pypi.tuna.tsinghua.edu.cn/simple

# 或使用阿里云镜像
pip install -e . -i https://mirrors.aliyun.com/pypi/simple/
```

### 6. 虚拟环境激活失败

**原因**: PowerShell 执行策略限制

**解决方案**:
```powershell
# 临时允许脚本执行
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# 然后重新激活虚拟环境
.\venv\Scripts\Activate.ps1
```

### 6.1. PowerShell 脚本执行被阻止

**原因**: PowerShell 默认执行策略限制脚本运行

**解决方案**:
```powershell
# 方案 1: 临时允许脚本执行（推荐）
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\start-dev.ps1

# 方案 2: 设置为 RemoteSigned（需要签名）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 方案 3: 以管理员身份运行
# 右键点击脚本，选择"以管理员身份运行"
```

**注意**: 方案 1 只对当前 PowerShell 会话有效，关闭窗口后需要重新设置。

### 7. 端口被占用

**原因**: 8088 或 9000 端口已被其他程序占用

**解决方案**:
```bash
# 查找占用端口的进程
# Windows PowerShell
netstat -ano | findstr :8088

# macOS/Linux
lsof -i :8088

# 杀死占用端口的进程（Windows）
taskkill /PID <进程ID> /F

# 或修改启动端口
superset run -p 8089  # 使用 8089 端口
```

### 8. ModuleNotFoundError: No module named 'xxx'

**原因**: 依赖未正确安装

**解决方案**:
```bash
# 重新安装依赖
pip install -e .
pip install -r requirements/development.txt
```

### 9. 前端编译错误

**原因**: 依赖版本冲突或缓存问题

**解决方案**:
```bash
# 清除缓存
rm -rf node_modules package-lock.json
npm cache clean --force

# 重新安装
npm install
```

### 10. 后端服务频繁重启

**原因**: 调试模式下的文件监控导致频繁重启，特别是在 Windows 环境中

**解决方案**:
```bash
# 方案 1: 不使用 --reload 参数（推荐用于 Windows）
superset run -p 8088 --with-threads --debugger --debug

# 方案 2: 使用环境变量禁用重载
set FLASK_RUN_RELOAD=0
superset run -p 8088 --with-threads --debugger --debug

# 方案 3: 使用生产模式（不推荐用于开发）
superset run -p 8088 --with-threads
```

**注意**: 不使用 `--reload` 参数后，修改后端代码需要手动重启服务。

### 11. 前端代理连接错误 (ECONNRESET)

**原因**: 后端服务重启或未完全启动时，前端代理尝试连接导致连接重置

**解决方案**:
1. 确保后端服务完全启动后再启动前端服务
2. 等待后端服务稳定后再访问前端页面
3. 如果后端频繁重启，参考问题 10 的解决方案

## 开发工作流

### 修改后端代码

1. 修改 `superset/` 目录下的 Python 文件
2. Flask 开发服务器自动检测变化并重启
3. 在浏览器中刷新 `http://localhost:9000`

### 修改前端代码

1. 修改 `superset-frontend/` 目录下的 TypeScript/React 文件
2. Webpack 自动重新编译
3. 浏览器自动更新（热重载）

### 查看日志

**后端日志**:
- Flask 开发服务器终端输出
- 包含请求、错误、调试信息

**前端日志**:
- Webpack 开发服务器终端输出
- 包含编译状态、警告、错误

### 调试技巧

**后端调试**:
- 使用 `print()` 语句输出调试信息
- 使用 Python `pdb` 调试器：`import pdb; pdb.set_trace()`
- 查看 Flask 开发服务器的错误输出

**前端调试**:
- 使用浏览器开发者工具（F12）
- 查看 Console 和 Network 标签
- 使用 React Developer Tools 浏览器扩展

## 停止服务

### 方式 1: 使用停止脚本（推荐）

**停止所有服务**:

```bash
# PowerShell
.\stop-dev.ps1

# 或使用批处理脚本
stop-dev.bat
```

### 方式 2: 手动停止

**停止后端服务**:

在后端服务运行的终端窗口中，按 `Ctrl + C`

**停止前端服务**:

在前端服务运行的终端窗口中，按 `Ctrl + C`

## 重新启动服务

### 方式 1: 使用启动脚本（推荐）

**启动所有服务**:

```bash
# PowerShell
.\start-dev.ps1

# 或使用批处理脚本
start-dev.bat
```

### 方式 2: 手动启动

**重新启动后端**:

```bash
# 激活虚拟环境
.\venv\Scripts\Activate.ps1

# 启动后端服务
superset run -p 8088 --with-threads --debugger --debug
```

**重新启动前端**:

```bash
cd superset-frontend
npm run dev-server
```

## 清理环境

如果需要完全清理环境并重新开始：

```bash
# 停止所有服务（Ctrl + C）

# 删除虚拟环境
# Windows PowerShell
Remove-Item venv -Recurse -Force

# macOS/Linux
rm -rf venv

# 删除数据库文件
# Windows PowerShell
Remove-Item superset.db -Force

# macOS/Linux
rm superset.db

# 删除前端依赖
# Windows PowerShell
Remove-Item superset-frontend\node_modules -Recurse -Force

# macOS/Linux
rm -rf superset-frontend/node_modules
```

## 相关文件

### 配置文件
- [superset_config.py](superset_config.py) - 主配置文件
- [webpack.proxy-config.js](superset-frontend/webpack.proxy-config.js) - 前端代理配置

### 启动脚本
- [start-dev.ps1](start-dev.ps1) - PowerShell 启动脚本（推荐）
- [stop-dev.ps1](stop-dev.ps1) - PowerShell 停止脚本
- [start-dev.bat](start-dev.bat) - 批处理启动脚本
- [stop-dev.bat](stop-dev.bat) - 批处理停止脚本

### 项目文档
- [README.md](README.md) - 项目说明
- [CONTRIBUTING.md](CONTRIBUTING.md) - 贡献指南
- [INSTALL.md](INSTALL.md) - 安装指南

## 获取帮助

如果遇到问题：

1. 查看本文档的"常见问题"部分
2. 查看项目 [README.md](README.md)
3. 查看项目 [CONTRIBUTING.md](CONTRIBUTING.md)
4. 在 GitHub 上提交 Issue: https://github.com/apache/superset/issues

## 下一步

环境搭建完成后，你可以：

1. 浏览 Superset 的功能界面
2. 创建第一个图表和仪表板
3. 修改代码并测试你的更改
4. 查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何贡献代码

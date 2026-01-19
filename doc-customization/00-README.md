# Apache Superset 源码阅读系列

本系列文档旨在帮助开发者深入理解 Apache Superset 的源码结构、架构设计和实现原理，为二次开发和定制化提供指导。

## 文档目录

### 基础篇
- [01-架构概览](./01-架构概览.md) - Superset 整体架构介绍
- [02-项目结构](./02-项目结构.md) - 项目目录结构详解
- [03-技术栈](./03-技术栈.md) - 前后端技术栈和核心组件

### 后端篇
- [04-后端架构](./04-后端架构.md) - Python Flask 后端架构
- [05-数据模型](./05-数据模型.md) - SQLAlchemy 数据库模型
- [06-核心模块](./06-核心模块.md) - 核心业务模块详解
- [07-查询引擎](./07-查询引擎.md) - 数据查询和处理机制

### 前端篇
- [08-前端架构](./08-前端架构.md) - React/TypeScript 前端架构
- [09-状态管理](./09-状态管理.md) - Redux 状态管理
- [10-可视化组件](./10-可视化组件.md) - 图表组件系统

### 扩展篇
- [11-插件系统](./11-插件系统.md) - 插件扩展机制
- [12-自定义图表](./12-自定义图表.md) - 开发自定义图表插件
- [13-认证授权](./13-认证授权.md) - 安全和权限系统

### 运维篇
- [14-请求流程](./14-请求流程.md) - HTTP 请求处理流程
- [15-部署配置](./15-部署配置.md) - 部署和配置指南
- [16-缓存机制](./16-缓存机制.md) - 缓存策略和实现

### 开发篇
- [17-调试指南](./17-调试指南.md) - 前后端调试方法
- [18-二次开发指南](./18-二次开发指南.md) - 二次开发最佳实践
- [19-性能优化](./19-性能优化.md) - 性能调优技巧

## 快速开始

### 环境准备

```bash
# 克隆代码
git clone https://github.com/apache/superset.git
cd superset

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -e .
cd superset-frontend
npm install
```

### 运行项目

```bash
# 启动后端
superset run

# 启动前端（新终端）
cd superset-frontend
npm run dev-server
```

## 核心概念

### 架构分层

```
┌─────────────────────────────────────────┐
│         Frontend (React/TS)          │
│  - UI Components                    │
│  - State Management (Redux)          │
│  - Chart Plugins                    │
└──────────────┬──────────────────────┘
               │ HTTP/WebSocket
┌──────────────▼──────────────────────┐
│       Backend (Flask/Python)         │
│  - REST API                        │
│  - Security & Auth                 │
│  - Query Engine                    │
└──────────────┬──────────────────────┘
               │ SQL
┌──────────────▼──────────────────────┐
│         Data Sources                │
│  - PostgreSQL                     │
│  - MySQL                         │
│  - BigQuery                      │
│  - ...                           │
└─────────────────────────────────────┘
```

### 核心模块

- **superset/**: Python 后端核心代码
- **superset-frontend/**: React 前端代码
- **superset-core/**: 共享核心库
- **superset-websocket/**: WebSocket 服务
- **superset-embedded-sdk/**: 嵌入式 SDK

## 学习路径

1. **入门**: 阅读 [架构概览](./01-架构概览.md) 和 [项目结构](./02-项目结构.md)
2. **后端**: 深入学习 [后端架构](./04-后端架构.md) 和 [数据模型](./05-数据模型.md)
3. **前端**: 了解 [前端架构](./08-前端架构.md) 和 [状态管理](./09-状态管理.md)
4. **扩展**: 学习 [插件系统](./11-插件系统.md) 和 [自定义图表](./12-自定义图表.md)
5. **实践**: 参考 [二次开发指南](./18-二次开发指南.md) 开始开发

## 关键文件索引

### 后端核心文件

- [superset/app.py](../superset/app.py) - Flask 应用入口
- [superset/config.py](../superset/config.py) - 配置文件
- [superset/initialization/__init__.py](../superset/initialization/__init__.py) - 应用初始化
- [superset/models/core.py](../superset/models/core.py) - 数据库模型
- [superset/common/query_context.py](../superset/common/query_context.py) - 查询上下文

### 前端核心文件

- [superset-frontend/src/views/App.tsx](../superset-frontend/src/views/App.tsx) - React 应用入口
- [superset-frontend/src/views/routes.tsx](../superset-frontend/src/views/routes.tsx) - 路由配置
- [superset-frontend/src/explore/](../superset-frontend/src/explore/) - 图表探索模块
- [superset-frontend/src/setup/setupPlugins.ts](../superset-frontend/src/setup/setupPlugins.ts) - 插件初始化

## 参考资源

- [官方文档](https://superset.apache.org/docs/introduction)
- [API 文档](https://superset.apache.org/docs/api)
- [贡献指南](../CONTRIBUTING.md)
- [本地开发指南](../Local-Dev.md)

## 版本信息

- Superset 版本: 6.0.0+
- Python 版本: 3.9-3.12
- Node.js 版本: 20.18.1+
- 文档更新时间: 2026-01-18

## 贡献

欢迎对本文档提出改进建议和补充内容。

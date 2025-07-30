# Superset MCP Service Documentation

Complete documentation for the Superset Model Context Protocol (MCP) service - 16 tools for programmatic Superset access.

## 🚀 Quick Start Guide

**New to MCP?** Follow this path:
1. **[Overview & Examples](./overview.mdx)** - Understand what MCP can do
2. **[API Reference](./api-reference.mdx)** - Try the tools with examples
3. **[Authentication](./authentication.mdx)** - Set up security for production

## 📚 Documentation by Role

### 👩‍💻 **Developers & Integrators**
| Guide | Purpose | When to Use |
|-------|---------|-------------|
| **[🚀 Overview](./overview.mdx)** | Features, use cases, examples | Starting with MCP service |
| **[📚 API Reference](./api-reference.mdx)** | All 16 tools with request/response | Building integrations |
| **[🔧 Development Guide](./development.mdx)** | Internal architecture, adding tools | Extending the service |

### 🔒 **DevOps & Production**
| Guide | Purpose | When to Use |
|-------|---------|-------------|
| **[🔐 Authentication](./authentication.mdx)** | JWT setup, RBAC, security | Production deployment |
| **[🏗️ Architecture](./architecture.mdx)** | System design, performance | Understanding internals |

### 🏢 **Enterprise Teams**
| Guide | Purpose | When to Use |
|-------|---------|-------------|
| **[🏢 Preset Integration](./preset-integration.mdx)** | RBAC extensions, OIDC | Enterprise features |

## 🛤️ Common User Journeys

### **"I want to explore data with AI"**
1. [Overview](./overview.mdx#use-cases) - See what's possible
2. [API Reference](./api-reference.mdx#dashboard-tools) - Try dashboard/chart tools
3. [Authentication](./authentication.mdx#quick-start) - Set up if needed

### **"I want to build an integration"**
1. [API Reference](./api-reference.mdx) - Understand all available tools
2. [Overview](./overview.mdx#example-workflow) - See integration patterns  
3. [Authentication](./authentication.mdx) - Implement security

### **"I want to add new MCP tools"**
1. [Development Guide](./development.mdx#adding-new-tools) - Step-by-step process
2. [Architecture](./architecture.mdx#tool-abstractions) - Understand patterns
3. [API Reference](./api-reference.mdx) - See existing tool examples

### **"I want to deploy in production"**
1. [Authentication](./authentication.mdx#production-mode) - Security setup
2. [Architecture](./architecture.mdx#deployment-considerations) - System design
3. [Preset Integration](./preset-integration.mdx) - Enterprise features

## 📖 Complete Reference

### Core Functionality
- **[Overview](./overview.mdx)** - What is MCP? Key features, architecture overview, getting started
- **[API Reference](./api-reference.mdx)** - Complete tool documentation with examples for all 16 tools
- **[Authentication](./authentication.mdx)** - JWT Bearer setup, RBAC, security configuration

### Advanced Topics  
- **[Development Guide](./development.mdx)** - Internal architecture, patterns, adding new tools
- **[Architecture](./architecture.mdx)** - System design, performance, deployment considerations
- **[Preset Integration](./preset-integration.mdx)** - Enterprise RBAC extensions and OIDC integration

## ✅ Status & Support

**Phase 1 Complete** - Core functionality stable, authentication production-ready, comprehensive testing coverage.

### Getting Help
- **🐛 Issues**: Report bugs or feature requests on GitHub
- **💬 Questions**: Check the appropriate guide above
- **🏢 Enterprise**: Contact Preset.io team for enterprise features
- **🔧 Development**: See [Development Guide](./development.mdx) for contribution guidelines

### What's Available Now
- ✅ **16 MCP Tools**: Full CRUD for dashboards, charts, datasets
- ✅ **JWT Authentication**: Production-ready security
- ✅ **Cache Control**: Leverage Superset's cache layers
- ✅ **Multi-format Export**: JSON, CSV, Excel, screenshots
- ✅ **Comprehensive Docs**: Complete API reference and guides

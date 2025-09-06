# Excel转Markdown前端应用

这是一个现代化的React前端应用，用于管理Excel文件转换为Markdown格式的任务。

## 功能特性

- 📁 **文件上传** - 支持单个和批量Excel文件上传
- 🔄 **任务管理** - 实时查看任务状态和进度
- 📋 **文件浏览** - 查看已处理的文件列表
- 🔍 **文档搜索** - 基于向量相似度的语义搜索
- 📊 **统计信息** - 系统运行状态和处理统计
- ⚙️ **系统设置** - 配置API连接和系统参数
- 🔔 **实时更新** - WebSocket连接实现实时状态更新

## 技术栈

- **React 18** - 前端框架
- **TypeScript** - 类型安全
- **Ant Design** - UI组件库
- **Axios** - HTTP客户端
- **Socket.IO** - WebSocket通信
- **React Router** - 路由管理
- **React Dropzone** - 文件拖拽上传

## 快速开始

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 配置环境变量

复制环境变量示例文件：

```bash
cp env.example .env
```

编辑 `.env` 文件，配置API地址：

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=http://localhost:8000
```

### 3. 启动开发服务器

```bash
npm start
```

应用将在 http://localhost:3000 启动。

### 4. 构建生产版本

```bash
npm run build
```

## 项目结构

```
frontend/
├── public/                 # 静态资源
├── src/
│   ├── components/         # React组件
│   │   ├── FileUpload.tsx     # 文件上传组件
│   │   ├── TaskManagement.tsx # 任务管理组件
│   │   ├── FileBrowser.tsx    # 文件浏览组件
│   │   ├── DocumentSearch.tsx # 文档搜索组件
│   │   ├── Statistics.tsx     # 统计信息组件
│   │   └── Settings.tsx       # 设置组件
│   ├── services/          # API服务
│   │   ├── api.ts            # API接口
│   │   └── websocket.ts      # WebSocket服务
│   ├── App.tsx            # 主应用组件
│   ├── App.css            # 应用样式
│   ├── index.tsx          # 应用入口
│   └── index.css          # 全局样式
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript配置
└── README.md             # 项目说明
```

## 主要功能

### 文件上传
- 支持拖拽上传Excel文件
- 单个文件转换
- 批量文件转换
- 转换并向量化
- 实时上传进度显示

### 任务管理
- 任务状态实时更新
- 任务进度显示
- 任务详情查看
- 任务删除管理

### 文件浏览
- 文件列表展示
- 文件状态跟踪
- 文件下载功能
- 文件删除管理

### 文档搜索
- 语义搜索功能
- 相似度评分
- 搜索结果高亮
- 搜索参数调整

### 统计信息
- 系统运行状态
- 处理统计信息
- 向量数据库统计
- 最近活动记录

### 系统设置
- API连接配置
- WebSocket设置
- 向量数据库配置
- 界面个性化设置

## API集成

前端通过以下方式与后端API集成：

1. **REST API** - 使用Axios进行HTTP请求
2. **WebSocket** - 使用Socket.IO进行实时通信
3. **文件上传** - 支持FormData格式的文件上传
4. **错误处理** - 统一的错误处理和用户提示

## 开发说明

### 添加新功能

1. 在 `src/components/` 中创建新组件
2. 在 `src/services/api.ts` 中添加API接口
3. 在 `App.tsx` 中添加路由配置
4. 更新导航菜单

### 样式定制

- 全局样式在 `src/index.css` 中定义
- 组件样式在各自的CSS文件中定义
- 使用Ant Design的主题系统进行样式定制

### 状态管理

- 使用React Hooks进行状态管理
- 本地存储用于设置持久化
- WebSocket事件用于实时状态更新

## 部署

### 开发环境

```bash
npm start
```

### 生产环境

```bash
npm run build
```

构建后的文件在 `build/` 目录中，可以部署到任何静态文件服务器。

### Docker部署

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 故障排除

### 常见问题

1. **API连接失败**
   - 检查后端服务是否启动
   - 确认API地址配置正确
   - 检查网络连接

2. **WebSocket连接失败**
   - 确认WebSocket服务已启动
   - 检查防火墙设置
   - 验证WebSocket URL配置

3. **文件上传失败**
   - 检查文件格式是否支持
   - 确认文件大小限制
   - 验证网络连接稳定性

### 调试模式

在开发环境中，可以通过浏览器开发者工具查看：
- 网络请求日志
- WebSocket连接状态
- 控制台错误信息

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT License

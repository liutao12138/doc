# Excel到向量任务链API文档

## 概述

本文档描述了Excel文件到向量数据库的完整任务链处理流程。该功能实现了从Excel文件批量上传、转换为Markdown、向量化存储到搜索查询的完整自动化流程。

**注意**: 系统已优化为仅支持批量处理，提供更高的效率和更好的用户体验。

## 核心功能

### 1. 任务链处理
- **Excel转Markdown**: 使用Docling将Excel文件转换为Markdown格式
- **Markdown向量化**: 将Markdown内容分割并向量化存储
- **统一文件管理**: 跟踪文件处理状态和元数据
- **错误处理**: 完整的错误捕获和状态更新

### 2. 主要API端点

#### `POST /upload-batch`
批量上传Excel文件并转换为Markdown

**请求参数:**
- `files`: Excel文件列表 (multipart/form-data)
- `output_dir`: 输出目录 (可选)

**响应示例:**
```json
{
  "message": "批量上传成功，3 个文件转换任务已启动",
  "task_id": "celery-task-id",
  "file_count": 3,
  "filenames": ["example1.xlsx", "example2.xlsx", "example3.xlsx"],
  "status": "processing",
  "check_status_url": "/task/{task_id}"
}
```

#### `POST /convert-and-vectorize`
一键完成Excel文件转换和向量化

**请求参数:**
- `file`: Excel文件 (multipart/form-data)
- `output_dir`: 输出目录 (可选)
- `vector_type`: 向量数据库类型 (milvus/elasticsearch, 默认milvus)

**响应示例:**
```json
{
  "message": "文件上传成功，转换和向量化任务已启动",
  "file_id": "uuid-string",
  "task_id": "celery-task-id",
  "filename": "example.xlsx",
  "vector_type": "milvus",
  "status": "processing",
  "check_status_url": "/task/{task_id}",
  "file_status_url": "/file/{file_id}"
}
```

#### `GET /file/{file_id}`
获取文件处理状态

**响应示例:**
```json
{
  "file_id": "uuid-string",
  "status": "completed",
  "stages": {
    "upload": {"status": "completed", "timestamp": "2024-01-01T00:00:00"},
    "convert": {"status": "completed", "timestamp": "2024-01-01T00:01:00"},
    "vectorize": {"status": "completed", "timestamp": "2024-01-01T00:02:00"}
  },
  "created_at": "2024-01-01T00:00:00",
  "original_filename": "example.xlsx"
}
```

#### `POST /search`
搜索向量化文档

**请求参数:**
- `query`: 搜索查询字符串
- `top_k`: 返回结果数量 (默认5)
- `similarity_threshold`: 相似度阈值 (默认0.7)
- `vector_type`: 向量数据库类型 (默认milvus)

#### `GET /vector-stats`
获取向量数据库统计信息

#### `GET /files`
列出所有文件记录

**查询参数:**
- `status`: 过滤状态 (uploaded/processing/completed/error)

#### `DELETE /file/{file_id}`
清理文件和相关数据

## 任务链架构

### Celery任务链
```python
# 任务链定义
workflow = chain(
    convert_excel_to_markdown_chain.s(file_path, file_id, output_dir),
    vectorize_markdown_chain.s(vector_type)
)
```

### 处理阶段
1. **上传阶段**: 文件上传和元数据创建
2. **转换阶段**: Excel → Markdown转换
3. **向量化阶段**: Markdown → 向量存储

### 状态管理
- **uploaded**: 文件已上传
- **processing**: 处理中
- **completed**: 处理完成
- **error**: 处理失败

## 文件管理

### 文件管理器 (FileManager)
- 统一管理文件生命周期
- 跟踪处理状态和元数据
- 支持文件清理和状态查询

### 元数据存储
```json
{
  "file_id": "uuid",
  "original_filename": "example.xlsx",
  "status": "completed",
  "stages": {
    "upload": {"status": "completed", "timestamp": "..."},
    "convert": {"status": "completed", "result": {...}},
    "vectorize": {"status": "completed", "result": {...}}
  },
  "paths": {
    "upload_path": "/uploads/uuid.xlsx",
    "markdown_path": "/output/example.md"
  },
  "metadata": {
    "document_count": 5,
    "vector_type": "milvus"
  }
}
```

## 错误处理

### 异常捕获
- 文件类型验证
- 文件存在性检查
- 转换过程异常
- 向量化过程异常

### 状态更新
- 实时任务状态更新
- 文件处理阶段状态跟踪
- 错误信息记录

### 重试机制
- 支持任务重试
- 失败状态记录
- 错误日志记录

## 使用示例

### Python客户端示例
```python
import requests

# 1. 上传文件并启动任务链
with open("example.xlsx", "rb") as f:
    files = {"file": ("example.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    response = requests.post("http://localhost:8000/convert-and-vectorize", files=files)

result = response.json()
file_id = result["file_id"]
task_id = result["task_id"]

# 2. 监控任务状态
while True:
    response = requests.get(f"http://localhost:8000/task/{task_id}")
    task_status = response.json()
    
    if task_status["state"] == "success":
        print("处理完成!")
        break
    elif task_status["state"] == "failure":
        print(f"处理失败: {task_status.get('error')}")
        break
    
    time.sleep(5)

# 3. 搜索文档
search_data = {
    "query": "搜索内容",
    "top_k": 5,
    "similarity_threshold": 0.7
}
response = requests.post("http://localhost:8000/search", json=search_data)
```

### curl示例
```bash
# 上传文件并启动任务链
curl -X POST "http://localhost:8000/convert-and-vectorize" \
  -F "file=@example.xlsx" \
  -F "vector_type=milvus"

# 检查文件状态
curl "http://localhost:8000/file/{file_id}"

# 搜索文档
curl -X POST "http://localhost:8000/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "搜索内容", "top_k": 5}'
```

## 测试

运行测试脚本:
```bash
python tests/test_task_chain.py
```

测试包括:
- 健康检查
- API端点信息
- 完整任务链流程
- 搜索功能
- 统计信息获取

## 配置

### 环境变量
```bash
# 向量数据库配置
MILVUS_HOST=milvus
MILVUS_PORT=19530
MILVUS_COLLECTION=excel_docs

ELASTICSEARCH_HOST=elasticsearch
ELASTICSEARCH_PORT=9200
ELASTICSEARCH_INDEX=excel_docs

# 向量化配置
EMBED_MODEL=sentence-transformers/all-MiniLM-L6-v2
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
SIMILARITY_THRESHOLD=0.7
TOP_K=5
```

### 目录结构
```
uploads/          # 上传文件目录
output/           # 输出文件目录
metadata/         # 元数据文件目录
```

## 监控和日志

### 日志文件
- `api.log`: API请求日志
- `celery_worker.log`: Celery任务日志

### 监控指标
- 任务执行状态
- 文件处理进度
- 错误率统计
- 处理时间统计

## 故障排除

### 常见问题
1. **文件上传失败**: 检查文件格式和大小限制
2. **转换失败**: 检查Docling依赖和文件内容
3. **向量化失败**: 检查向量数据库连接
4. **搜索无结果**: 检查向量数据库内容和相似度阈值

### 调试步骤
1. 检查服务健康状态
2. 查看任务状态和错误信息
3. 检查文件处理状态
4. 查看日志文件
5. 验证向量数据库连接

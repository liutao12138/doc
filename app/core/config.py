# Celery配置文件
import os

# Redis配置
broker_url = "redis://localhost:6379/0"
result_backend = "redis://localhost:6379/0"

# 任务序列化
task_serializer = "json"
accept_content = ["json"]
result_serializer = "json"

# 时区设置
timezone = "Asia/Shanghai"
enable_utc = True

# 任务路由
task_routes = {
    "app.core.celery_app.batch_convert_excel_to_markdown": {"queue": "excel_conversion"},
    "app.core.celery_app.vectorize_markdown": {"queue": "vectorization"},
    "app.core.celery_app.convert_and_vectorize_chain": {"queue": "excel_conversion"},
}

# 工作进程配置
worker_prefetch_multiplier = 1
task_acks_late = True
worker_disable_rate_limits = True

# 任务超时设置
task_time_limit = 300  # 5分钟
task_soft_time_limit = 240  # 4分钟

# 日志配置
worker_log_format = "[%(asctime)s: %(levelname)s/%(processName)s] %(message)s"
worker_task_log_format = "[%(asctime)s: %(levelname)s/%(processName)s][%(task_name)s(%(task_id)s)] %(message)s"

# 结果过期时间（秒）
result_expires = 3600  # 1小时

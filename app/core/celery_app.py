from celery import Celery
import os
import logging
from pathlib import Path
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import PdfFormatOption

# 导入服务模块
from app.services.vector_processor import VectorizationProcessor
from app.services.file_manager import FileManager

os.environ['FORKED_BY_MULTIPROCESSING'] = '1'

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("celery_worker.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# 创建Celery应用 - 使用完整的配置
app = Celery("excel_to_md_converter")

# 完整的配置
app.conf.update(
    broker_url="redis://localhost:6379/0",
    result_backend="redis://localhost:6379/0",
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    # 任务路由配置
    task_routes={
        "app.core.celery_app.batch_convert_excel_to_markdown": {"queue": "excel_conversion"},
        "app.core.celery_app.vectorize_markdown": {"queue": "vectorization"},
        "app.core.celery_app.convert_and_vectorize_chain": {"queue": "excel_conversion"},
    },
    # 工作进程配置
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_disable_rate_limits=True,
    # 任务超时设置
    task_time_limit=300,  # 5分钟
    task_soft_time_limit=240,  # 4分钟
    # 结果过期时间
    result_expires=3600,  # 1小时
    # 任务发现配置
    include=['app.core.celery_app'],
)

# 创建文档转换器
def get_document_converter():
    """获取配置好的文档转换器"""
    try:
        # 简化配置，专注于Excel文件转换
        converter = DocumentConverter(
            allowed_formats=[
                InputFormat.XLSX,
                InputFormat.XLS,
                InputFormat.DOCX,
                InputFormat.DOC,
                InputFormat.PDF,
            ],
        )
        logger.info("文档转换器创建成功")
        return converter
    except Exception as e:
        logger.error(f"创建文档转换器失败: {e}")
        # 尝试创建最基本的转换器
        try:
            logger.info("尝试创建基本转换器...")
            converter = DocumentConverter()
            logger.info("基本转换器创建成功")
            return converter
        except Exception as e2:
            logger.error(f"基本转换器创建也失败: {e2}")
            raise Exception(f"无法创建文档转换器: {e}, 基本转换器也失败: {e2}")

# ============================================================================
# 基础转换任务
# ============================================================================

# 内部转换函数，用于批量处理和任务链
def _convert_excel_to_markdown(file_path, output_dir=None, file_id=None):
    """
    将Excel文件转换为Markdown格式（内部函数）
    
    Args:
        file_path (str): Excel文件路径
        output_dir (str): 输出目录，默认为当前目录下的output文件夹
        file_id (str): 文件ID，用于任务链状态管理
    
    Returns:
        dict: 转换结果信息
    """
    try:
        # 如果提供了file_id，更新文件管理器状态
        if file_id:
            file_manager = FileManager()
            file_manager.update_stage_status(file_id, "convert", "processing")
        
        # 检查文件是否存在
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        # 创建输出目录
        if output_dir is None:
            output_dir = os.path.join(os.getcwd(), "output")
        
        os.makedirs(output_dir, exist_ok=True)
        
        # 获取文档转换器
        logger.info(f"开始转换文件: {file_path}")
        converter = get_document_converter()
        
        # 检查文件格式
        file_ext = Path(file_path).suffix.lower()
        logger.info(f"文件扩展名: {file_ext}")
        
        # 转换文档
        logger.info("开始调用Docling转换器...")
        result = converter.convert(file_path)
        logger.info("Docling转换器调用成功")
        
        # 生成输出文件名
        input_file = Path(file_path)
        output_filename = f"{input_file.stem}.md"
        output_path = os.path.join(output_dir, output_filename)
        
        # 导出为Markdown
        logger.info("开始导出为Markdown...")
        try:
            markdown_content = result.document.export_to_markdown()
            logger.info(f"Markdown导出成功，内容长度: {len(markdown_content)} 字符")
        except Exception as e:
            logger.error(f"Markdown导出失败: {e}")
            raise Exception(f"Markdown导出失败: {str(e)}")
        
        # 保存Markdown文件
        logger.info(f"保存Markdown文件到: {output_path}")
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(markdown_content)
            logger.info("Markdown文件保存成功")
        except Exception as e:
            logger.error(f"保存Markdown文件失败: {e}")
            raise Exception(f"保存Markdown文件失败: {str(e)}")
        
        # 准备返回结果
        result_info = {
            "status": "success",
            "input_file": file_path,
            "output_file": output_path,
            "output_dir": output_dir,
            "file_size": os.path.getsize(output_path),
            "message": "Excel文件成功转换为Markdown"
        }
        
        # 如果提供了file_id，添加到结果中并更新文件管理器状态
        if file_id:
            result_info["file_id"] = file_id
            file_manager.update_stage_status(file_id, "convert", "completed", result_info)
        
        logger.info(f"成功转换文件: {file_path} -> {output_path}")
        return result_info
        
    except Exception as e:
        error_msg = f"转换失败: {str(e)}"
        logger.error(error_msg)
        
        # 如果提供了file_id，更新文件管理器状态
        if file_id:
            try:
                file_manager = FileManager()
                file_manager.update_stage_status(file_id, "convert", "error", error=error_msg)
            except:
                pass
        
        # 准备失败结果
        failure_result = {
            "status": "error",
            "error": error_msg,
            "input_file": file_path
        }
        if file_id:
            failure_result["file_id"] = file_id
            
        raise Exception(error_msg)

# ============================================================================
# Celery 任务定义
# ============================================================================

@app.task(bind=True, name='app.core.celery_app.batch_convert_excel_to_markdown')
def batch_convert_excel_to_markdown(self, file_paths, output_dir=None, file_ids=None):
    """
    批量转换Excel文件为Markdown格式
    
    Args:
        file_paths (list): Excel文件路径列表
        output_dir (str): 输出目录，默认为当前目录下的output文件夹
        file_ids (list): 对应的文件ID列表，用于更新数据库状态
    
    Returns:
        dict: 批量转换结果
    """
    try:
        logger.info(f"开始批量转换任务，文件数量: {len(file_paths)}")
        
        # 如果没有提供file_ids，创建临时的文件记录
        if file_ids is None:
            file_ids = []
            file_manager = FileManager()
            for file_path in file_paths:
                # 为每个文件创建临时记录
                original_filename = Path(file_path).name
                file_record = file_manager.create_file_record(original_filename)
                file_ids.append(file_record["file_id"])
                logger.info(f"为文件创建临时记录: {file_path} -> {file_record['file_id']}")
        
        results = []
        success_count = 0
        error_count = 0
        
        for i, file_path in enumerate(file_paths):
            file_id = file_ids[i] if i < len(file_ids) else None
            try:
                result = _convert_excel_to_markdown(file_path, output_dir, file_id)
                results.append(result)
                success_count += 1
                logger.info(f"转换成功: {file_path}")
            except Exception as e:
                error_result = {
                    "status": "error",
                    "input_file": file_path,
                    "error": str(e)
                }
                if file_id:
                    error_result["file_id"] = file_id
                results.append(error_result)
                error_count += 1
                logger.error(f"转换失败: {file_path}, 错误: {str(e)}")
        
        # 准备批量结果
        batch_result = {
            "status": "completed",
            "total_files": len(file_paths),
            "success_count": success_count,
            "error_count": error_count,
            "results": results,
            "file_ids": file_ids,
            "message": f"批量转换完成，成功: {success_count}, 失败: {error_count}"
        }
        
        logger.info(f"批量转换任务完成: {batch_result['message']}")
        return batch_result
        
    except Exception as e:
        error_msg = f"批量转换任务失败: {str(e)}"
        logger.error(error_msg)
        raise Exception(error_msg)

@app.task(bind=True, name='app.core.celery_app.vectorize_markdown')
def vectorize_markdown(self, convert_result: dict, vector_type: str = "milvus"):
    """任务链中的向量化任务 - 直接实现向量化逻辑"""
    try:
        file_id = convert_result["file_id"]
        markdown_path = convert_result["output_file"]
        
        logger.info(f"开始向量化任务: {file_id}")
        
        # 更新文件管理器状态
        file_manager = FileManager()
        file_manager.update_stage_status(file_id, "vectorize", "processing")
        
        # 创建向量处理器
        vector_processor = VectorizationProcessor()
        
        # 执行向量化
        vector_result = vector_processor.process_file(
            file_path=markdown_path,
            file_id=file_id,
            vector_type=vector_type
        )
        
        # 更新文件管理器状态
        file_manager.update_stage_status(file_id, "vectorize", "completed", vector_result)
        
        logger.info(f"向量化任务完成: {file_id}")
        return vector_result
        
    except Exception as e:
        error_msg = f"向量化任务失败: {str(e)}"
        logger.error(error_msg)
        
        # 更新文件管理器状态
        try:
            file_manager = FileManager()
            file_manager.update_stage_status(file_id, "vectorize", "error", error=error_msg)
        except:
            pass
            
        raise Exception(error_msg)

@app.task(bind=True, name='app.core.celery_app.convert_and_vectorize_chain')
def convert_and_vectorize_chain(self, file_path: str, file_id: str, output_dir: str = None, vector_type: str = "milvus"):
    """完整的Excel到向量任务链"""
    try:
        logger.info(f"开始完整任务链: {file_id}")
        
        # 更新文件管理器状态
        file_manager = FileManager()
        file_manager.update_stage_status(file_id, "convert", "processing")
        
        # 第一步：转换Excel到Markdown
        convert_result = _convert_excel_to_markdown(file_path, output_dir, file_id)
        
        # 更新转换阶段状态
        file_manager.update_stage_status(file_id, "convert", "completed", convert_result)
        
        # 第二步：向量化Markdown（直接调用向量化逻辑，不使用Celery任务）
        logger.info(f"开始向量化任务: {file_id}")
        
        # 更新文件管理器状态
        file_manager.update_stage_status(file_id, "vectorize", "processing")
        
        # 创建向量处理器
        vector_processor = VectorizationProcessor()
        
        # 执行向量化
        vector_result = vector_processor.process_file(
            file_path=convert_result["output_file"],
            file_id=file_id,
            vector_type=vector_type
        )
        
        # 更新文件管理器状态
        file_manager.update_stage_status(file_id, "vectorize", "completed", vector_result)
        
        # 合并结果
        final_result = {
            "status": "completed",
            "file_id": file_id,
            "convert_result": convert_result,
            "vector_result": vector_result,
            "message": "完整任务链执行成功"
        }
        
        logger.info(f"完整任务链完成: {file_id}")
        return final_result
        
    except Exception as e:
        error_msg = f"完整任务链失败: {str(e)}"
        logger.error(error_msg)
        
        # 更新文件管理器状态
        try:
            file_manager = FileManager()
            file_manager.update_stage_status(file_id, "vectorize", "error", error=error_msg)
        except:
            pass
            
        raise Exception(error_msg)

# 确保任务被正确注册
if __name__ == "__main__":
    # 列出所有注册的任务
    print("已注册的任务:")
    for task_name in app.tasks.keys():
        if not task_name.startswith('celery.'):
            print(f"  - {task_name}")

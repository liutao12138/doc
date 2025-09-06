from celery import Celery, chain
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

# 创建Celery应用
app = Celery("excel_to_md_converter")
app.config_from_object("app.core.config")

# 创建文档转换器
def get_document_converter():
    """获取配置好的文档转换器"""
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = True
    pipeline_options.do_table_structure = True
    pipeline_options.table_structure_options.do_cell_matching = True
    
    converter = DocumentConverter(
        allowed_formats=[
            InputFormat.PDF,
            InputFormat.IMAGE,
            InputFormat.DOCX,
            InputFormat.HTML,
            InputFormat.PPTX,
            InputFormat.XLSX,  # 支持Excel文件
            InputFormat.ASCIIDOC,
            InputFormat.MD,
        ],
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        },
    )
    return converter

# ============================================================================
# 基础转换任务
# ============================================================================

@app.task(bind=True)
def convert_excel_to_markdown(self, file_path, output_dir=None, file_id=None):
    """
    将Excel文件转换为Markdown格式
    
    Args:
        file_path (str): Excel文件路径
        output_dir (str): 输出目录，默认为当前目录下的output文件夹
        file_id (str): 文件ID，用于任务链状态管理
    
    Returns:
        dict: 转换结果信息
    """
    try:
        # 更新任务状态
        self.update_state(state="PROGRESS", meta={"status": "开始转换", "progress": 10})
        
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
        
        # 更新任务状态
        self.update_state(state="PROGRESS", meta={"status": "开始初始化转换器", "progress": 20})
        
        # 获取文档转换器
        converter = get_document_converter()
        
        # 更新任务状态
        self.update_state(state="PROGRESS", meta={"status": "正在转换文档", "progress": 40})
        
        # 转换文档
        result = converter.convert(file_path)
        
        # 更新任务状态
        self.update_state(state="PROGRESS", meta={"status": "正在生成Markdown文件", "progress": 70})
        
        # 生成输出文件名
        input_file = Path(file_path)
        output_filename = f"{input_file.stem}.md"
        output_path = os.path.join(output_dir, output_filename)
        
        # 导出为Markdown
        markdown_content = result.document.export_to_markdown()
        
        # 保存Markdown文件
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(markdown_content)
        
        # 更新任务状态
        self.update_state(state="PROGRESS", meta={"status": "转换完成", "progress": 90})
        
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
        
        # 更新任务状态
        self.update_state(state="SUCCESS", meta=result_info)
        
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
        
        # 更新任务状态为失败
        failure_meta = {
            "status": "error",
            "error": error_msg,
            "input_file": file_path
        }
        if file_id:
            failure_meta["file_id"] = file_id
            
        self.update_state(state="FAILURE", meta=failure_meta)
        raise Exception(error_msg)

@app.task(bind=True)
def batch_convert_excel_to_markdown(self, file_paths, output_dir=None):
    """
    批量转换Excel文件为Markdown格式
    
    Args:
        file_paths (list): Excel文件路径列表
        output_dir (str): 输出目录
    
    Returns:
        dict: 批量转换结果
    """
    try:
        results = []
        total_files = len(file_paths)
        
        for i, file_path in enumerate(file_paths):
            # 更新任务状态
            progress = int((i / total_files) * 100)
            self.update_state(
                state="PROGRESS", 
                meta={
                    "status": f"正在处理文件 {i+1}/{total_files}",
                    "progress": progress,
                    "current_file": file_path
                }
            )
            
            try:
                # 转换单个文件
                result = convert_excel_to_markdown(file_path, output_dir)
                results.append({
                    "file": file_path,
                    "status": "success",
                    "output": result["output_file"]
                })
            except Exception as e:
                results.append({
                    "file": file_path,
                    "status": "error",
                    "error": str(e)
                })
        
        # 统计结果
        success_count = sum(1 for r in results if r["status"] == "success")
        error_count = sum(1 for r in results if r["status"] == "error")
        
        batch_result = {
            "status": "completed",
            "total_files": total_files,
            "success_count": success_count,
            "error_count": error_count,
            "results": results,
            "output_dir": output_dir
        }
        
        self.update_state(state="SUCCESS", meta=batch_result)
        logger.info(f"批量转换完成: {success_count}/{total_files} 成功")
        
        return batch_result
        
    except Exception as e:
        error_msg = f"批量转换失败: {str(e)}"
        logger.error(error_msg)
        
        self.update_state(
            state="FAILURE",
            meta={
                "status": "error",
                "error": error_msg
            }
        )
        raise Exception(error_msg)

# ============================================================================
# 向量化任务
# ============================================================================

# ============================================================================
# 任务链相关任务
# ============================================================================


@app.task(bind=True, name="vectorize_markdown")
def vectorize_markdown(self, convert_result: dict, vector_type: str = "milvus"):
    """任务链中的向量化任务 - 直接实现向量化逻辑"""
    try:
        file_id = convert_result["file_id"]
        markdown_path = convert_result["output_file"]
        
        logger.info(f"开始任务链向量化: {file_id}")
        
        # 更新文件管理器状态
        file_manager = FileManager()
        file_manager.update_stage_status(file_id, "vectorize", "processing")
        
        # 直接使用基础向量化任务的逻辑
        self.update_state(
            state="PROGRESS",
            meta={
                "status": "processing",
                "message": "正在处理向量化文档..."
            }
        )
        
        # 创建向量化处理器
        processor = VectorizationProcessor(vector_type)
        
        # 处理Markdown文件
        result = processor.process_markdown_file(markdown_path, file_id)
        
        if result["status"] == "success":
            logger.info(f"任务链向量化成功: {file_id}")
            
            # 更新文件管理器状态
            file_manager.update_stage_status(file_id, "vectorize", "completed", result)
            
            # 合并结果
            final_result = {
                **convert_result,
                "vectorization": result,
                "status": "completed",
                "message": "Excel文件成功转换并向量化"
            }
            
            self.update_state(state="SUCCESS", meta=final_result)
            return final_result
        else:
            logger.error(f"任务链向量化失败: {file_id}")
            
            # 更新文件管理器状态
            file_manager.update_stage_status(file_id, "vectorize", "error", error=result.get("error"))
            
            self.update_state(state="FAILURE", meta=result)
            return result
        
    except Exception as e:
        error_msg = f"任务链向量化失败: {str(e)}"
        logger.error(error_msg)
        
        # 更新文件管理器状态
        try:
            file_manager = FileManager()
            file_manager.update_stage_status(file_id, "vectorize", "error", error=error_msg)
        except:
            pass
        
        self.update_state(
            state="FAILURE",
            meta={
                "status": "error",
                "error": error_msg,
                "file_id": file_id
            }
        )
        raise Exception(error_msg)

@app.task(bind=True, name="convert_and_vectorize_chain")
def convert_and_vectorize_chain(self, file_path: str, file_id: str, output_dir: str = None, vector_type: str = "milvus"):
    """完整的Excel到向量任务链"""
    try:
        logger.info(f"开始完整任务链: {file_id}")
        
        # 创建任务链 
        workflow = chain(
            convert_excel_to_markdown.s(file_path, output_dir, file_id),
            vectorize_markdown.s(vector_type)
        )
        
        # 执行任务链
        result = workflow.apply_async()
        
        # 等待结果
        final_result = result.get()
        
        logger.info(f"完整任务链执行成功: {file_id}")
        return final_result
        
    except Exception as e:
        error_msg = f"完整任务链执行失败: {str(e)}"
        logger.error(error_msg)
        
        # 更新文件管理器状态
        try:
            file_manager = FileManager()
            file_manager.update_stage_status(file_id, "vectorize", "error", error=error_msg)
        except:
            pass
        
        self.update_state(
            state="FAILURE",
            meta={
                "status": "error",
                "error": error_msg,
                "file_id": file_id
            }
        )
        raise Exception(error_msg)

if __name__ == "__main__":
    app.start()
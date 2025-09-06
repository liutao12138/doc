from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
import os
import logging
from pathlib import Path
from typing import List, Optional
import uuid
from app.core.celery_app import (
    convert_excel_to_markdown, 
    batch_convert_excel_to_markdown,
    convert_and_vectorize_chain
)
from app.services.file_manager import FileManager
from app.services.vector_processor import VectorizationProcessor
from celery.result import AsyncResult
import tempfile
import shutil

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("api.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(
    title="Excel转Markdown服务",
    description="使用Docling+Celery实现Excel文件转换为Markdown的异步处理",
    version="1.0.0"
)

# 创建必要的目录
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("output")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

@app.get("/")
async def root():
    """根路径，返回服务信息"""
    return {
        "message": "Excel转Markdown服务",
        "version": "1.0.0",
        "endpoints": {
            "upload_single": "/upload-single",
            "upload_batch": "/upload-batch",
            "convert_and_vectorize": "/convert-and-vectorize",
            "task_status": "/task/{task_id}",
            "file_status": "/file/{file_id}",
            "search_documents": "/search",
            "vector_stats": "/vector-stats",
            "download": "/download/{filename}",
            "health": "/health"
        }
    }

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy", "service": "excel-to-markdown"}

@app.post("/upload-single")
async def upload_single_file(
    file: UploadFile = File(...),
    output_dir: Optional[str] = None
):
    """
    上传单个Excel文件并转换为Markdown
    
    Args:
        file: 上传的Excel文件
        output_dir: 输出目录（可选）
    
    Returns:
        dict: 任务信息
    """
    try:
        # 检查文件类型
        if not file.filename.lower().endswith((".xlsx", ".xls")):
            raise HTTPException(
                status_code=400, 
                detail="只支持Excel文件格式 (.xlsx, .xls)"
            )
        
        # 生成唯一文件名
        file_id = str(uuid.uuid4())
        file_extension = Path(file.filename).suffix
        temp_filename = f"{file_id}{file_extension}"
        temp_path = UPLOAD_DIR / temp_filename
        
        # 保存上传的文件
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        logger.info(f"文件上传成功: {file.filename} -> {temp_path}")
        
        # 启动转换任务
        task = convert_excel_to_markdown.delay(str(temp_path), output_dir)
        
        return {
            "message": "文件上传成功，转换任务已启动",
            "task_id": task.id,
            "filename": file.filename,
            "status": "processing",
            "check_status_url": f"/task/{task.id}"
        }
        
    except Exception as e:
        logger.error(f"上传文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")

@app.post("/upload-batch")
async def upload_batch_files(
    files: List[UploadFile] = File(...),
    output_dir: Optional[str] = None
):
    """
    批量上传Excel文件并转换为Markdown
    
    Args:
        files: 上传的Excel文件列表
        output_dir: 输出目录（可选）
    
    Returns:
        dict: 批量任务信息
    """
    try:
        # 检查文件数量
        if len(files) > 10:
            raise HTTPException(
                status_code=400,
                detail="一次最多上传10个文件"
            )
        
        # 检查文件类型并保存
        file_paths = []
        temp_files = []
        
        for file in files:
            if not file.filename.lower().endswith((".xlsx", ".xls")):
                raise HTTPException(
                    status_code=400,
                    detail=f"文件 {file.filename} 不是Excel格式"
                )
            
            # 生成唯一文件名
            file_id = str(uuid.uuid4())
            file_extension = Path(file.filename).suffix
            temp_filename = f"{file_id}{file_extension}"
            temp_path = UPLOAD_DIR / temp_filename
            
            # 保存文件
            with open(temp_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            
            file_paths.append(str(temp_path))
            temp_files.append(temp_path)
        
        logger.info(f"批量上传成功: {len(files)} 个文件")
        
        # 启动批量转换任务
        task = batch_convert_excel_to_markdown.delay(file_paths, output_dir)
        
        return {
            "message": f"批量上传成功，{len(files)} 个文件转换任务已启动",
            "task_id": task.id,
            "file_count": len(files),
            "filenames": [f.filename for f in files],
            "status": "processing",
            "check_status_url": f"/task/{task.id}"
        }
        
    except Exception as e:
        # 清理临时文件
        for temp_file in temp_files:
            if temp_file.exists():
                temp_file.unlink()
        
        logger.error(f"批量上传失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"批量上传失败: {str(e)}")

@app.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """
    获取任务状态
    
    Args:
        task_id: 任务ID
    
    Returns:
        dict: 任务状态信息
    """
    try:
        task_result = AsyncResult(task_id)
        
        if task_result.state == "PENDING":
            return {
                "task_id": task_id,
                "state": "pending",
                "status": "任务等待中"
            }
        elif task_result.state == "PROGRESS":
            return {
                "task_id": task_id,
                "state": "progress",
                "status": "处理中",
                "progress": task_result.info.get("progress", 0),
                "message": task_result.info.get("status", "正在处理")
            }
        elif task_result.state == "SUCCESS":
            result = task_result.result
            return {
                "task_id": task_id,
                "state": "success",
                "status": "完成",
                "result": result
            }
        elif task_result.state == "FAILURE":
            return {
                "task_id": task_id,
                "state": "failure",
                "status": "失败",
                "error": str(task_result.info)
            }
        else:
            return {
                "task_id": task_id,
                "state": task_result.state,
                "status": "未知状态"
            }
            
    except Exception as e:
        logger.error(f"获取任务状态失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取任务状态失败: {str(e)}")

@app.get("/download/{filename}")
async def download_file(filename: str):
    """
    下载转换后的Markdown文件
    
    Args:
        filename: 文件名
    
    Returns:
        FileResponse: 文件下载响应
    """
    try:
        file_path = OUTPUT_DIR / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type="text/markdown"
        )
        
    except Exception as e:
        logger.error(f"下载文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"下载文件失败: {str(e)}")

@app.get("/files")
async def list_files():
    """
    列出所有可下载的文件
    
    Returns:
        dict: 文件列表
    """
    try:
        files = []
        for file_path in OUTPUT_DIR.glob("*.md"):
            files.append({
                "filename": file_path.name,
                "size": file_path.stat().st_size,
                "created": file_path.stat().st_ctime,
                "download_url": f"/download/{file_path.name}"
            })
        
        return {
            "files": files,
            "count": len(files)
        }
        
    except Exception as e:
        logger.error(f"列出文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"列出文件失败: {str(e)}")

@app.delete("/cleanup")
async def cleanup_files():
    """
    清理临时文件和输出文件
    
    Returns:
        dict: 清理结果
    """
    try:
        # 清理上传目录
        upload_count = 0
        for file_path in UPLOAD_DIR.glob("*"):
            if file_path.is_file():
                file_path.unlink()
                upload_count += 1
        
        # 清理输出目录
        output_count = 0
        for file_path in OUTPUT_DIR.glob("*"):
            if file_path.is_file():
                file_path.unlink()
                output_count += 1
        
        return {
            "message": "清理完成",
            "upload_files_removed": upload_count,
            "output_files_removed": output_count
        }
        
    except Exception as e:
        logger.error(f"清理文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"清理文件失败: {str(e)}")

@app.post("/convert-and-vectorize")
async def convert_and_vectorize(
    file: UploadFile = File(...),
    output_dir: Optional[str] = None,
    vector_type: str = "milvus"
):
    """
    上传Excel文件并自动转换为Markdown并向量化
    
    Args:
        file: 上传的Excel文件
        output_dir: 输出目录（可选）
        vector_type: 向量数据库类型 (milvus/elasticsearch)
    
    Returns:
        dict: 任务信息
    """
    try:
        # 检查文件类型
        if not file.filename.lower().endswith((".xlsx", ".xls")):
            raise HTTPException(
                status_code=400, 
                detail="只支持Excel文件格式 (.xlsx, .xls)"
            )
        
        # 创建文件管理器
        file_manager = FileManager()
        
        # 创建文件记录
        file_record = file_manager.create_file_record(
            file.filename, 
            file.size or 0
        )
        file_id = file_record["file_id"]
        
        # 保存上传的文件
        temp_path = Path(file_record["paths"]["upload_path"])
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        logger.info(f"文件上传成功: {file.filename} -> {temp_path}")
        
        # 启动任务链
        task = convert_and_vectorize_chain.delay(
            str(temp_path), 
            file_id, 
            output_dir, 
            vector_type
        )
        
        return {
            "message": "文件上传成功，转换和向量化任务已启动",
            "file_id": file_id,
            "task_id": task.id,
            "filename": file.filename,
            "vector_type": vector_type,
            "status": "processing",
            "check_status_url": f"/task/{task.id}",
            "file_status_url": f"/file/{file_id}"
        }
        
    except Exception as e:
        logger.error(f"转换和向量化失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")

@app.get("/file/{file_id}")
async def get_file_status(file_id: str):
    """
    获取文件处理状态
    
    Args:
        file_id: 文件ID
    
    Returns:
        dict: 文件状态信息
    """
    try:
        file_manager = FileManager()
        status = file_manager.get_file_status(file_id)
        
        if "error" in status:
            raise HTTPException(status_code=404, detail=status["error"])
        
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文件状态失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取文件状态失败: {str(e)}")

@app.post("/search")
async def search_documents(
    query: str,
    top_k: int = 5,
    similarity_threshold: float = 0.7,
    vector_type: str = "milvus"
):
    """
    搜索向量化文档
    
    Args:
        query: 搜索查询
        top_k: 返回结果数量
        similarity_threshold: 相似度阈值
        vector_type: 向量数据库类型
    
    Returns:
        dict: 搜索结果
    """
    try:
        # 直接调用向量化处理器进行搜索
        processor = VectorizationProcessor(vector_type)
        result = processor.search_documents(query, top_k, similarity_threshold)
        
        if result["status"] == "success":
            return {
                "message": "搜索完成",
                "query": query,
                "parameters": {
                    "top_k": top_k,
                    "similarity_threshold": similarity_threshold,
                    "vector_type": vector_type
                },
                "results": result.get("results", []),
                "total_found": result.get("total_found", 0)
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "搜索失败"))
        
    except Exception as e:
        logger.error(f"搜索失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")

@app.get("/vector-stats")
async def get_vector_stats(vector_type: str = "milvus"):
    """
    获取向量数据库统计信息
    
    Args:
        vector_type: 向量数据库类型
    
    Returns:
        dict: 统计信息
    """
    try:
        # 直接调用向量化处理器获取统计信息
        processor = VectorizationProcessor(vector_type)
        result = processor.get_vector_stats()
        
        if result["status"] == "success":
            return {
                "message": "统计信息获取完成",
                "vector_type": vector_type,
                "stats": result.get("stats", {})
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "获取统计信息失败"))
        
    except Exception as e:
        logger.error(f"获取统计信息失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")

@app.get("/files")
async def list_files(status: Optional[str] = None):
    """
    列出所有文件记录
    
    Args:
        status: 过滤状态 (uploaded/processing/completed/error)
    
    Returns:
        dict: 文件列表
    """
    try:
        file_manager = FileManager()
        files = file_manager.list_files(status)
        
        return {
            "files": files,
            "count": len(files),
            "status_filter": status
        }
        
    except Exception as e:
        logger.error(f"列出文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"列出文件失败: {str(e)}")

@app.delete("/file/{file_id}")
async def cleanup_file(file_id: str):
    """
    清理文件和相关数据
    
    Args:
        file_id: 文件ID
    
    Returns:
        dict: 清理结果
    """
    try:
        file_manager = FileManager()
        result = file_manager.cleanup_file(file_id)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"清理文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"清理文件失败: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
import os
import uuid
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime
import json
import threading
from .database import DatabaseManager

logger = logging.getLogger(__name__)

class FileManager:
    """统一管理文件生命周期和元数据（单例模式）"""
    
    _instance = None
    _lock = threading.Lock()
    _initialized = False
    
    def __new__(cls, upload_dir: str = "uploads", output_dir: str = "output"):
        """单例模式实现"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(FileManager, cls).__new__(cls)
        return cls._instance
    
    def __init__(self, upload_dir: str = "uploads", output_dir: str = "output"):
        """初始化文件管理器（只执行一次）"""
        if not self._initialized:
            with self._lock:
                if not self._initialized:
                    self.upload_dir = Path(upload_dir)
                    self.output_dir = Path(output_dir)
                    
                    # 创建必要的目录
                    self.upload_dir.mkdir(exist_ok=True)
                    self.output_dir.mkdir(exist_ok=True)
                    
                    # 使用单例的数据库管理器
                    self.db = DatabaseManager()
                    self._initialized = True
                    logger.info("FileManager 单例实例初始化完成")
    
    def create_file_record(self, original_filename: str, file_size: int = 0) -> Dict[str, Any]:
        """创建文件记录"""
        file_id = str(uuid.uuid4())
        file_extension = Path(original_filename).suffix
        temp_filename = f"{file_id}{file_extension}"
        upload_path = str(self.upload_dir / temp_filename)
        
        # 使用数据库创建记录
        file_record = self.db.create_file_record(
            file_id=file_id,
            original_filename=original_filename,
            temp_filename=temp_filename,
            file_size=file_size,
            upload_path=upload_path
        )
        
        return file_record
    
    def update_stage_status(self, file_id: str, stage: str, status: str, 
                          result: Optional[Dict[str, Any]] = None, 
                          error: Optional[str] = None) -> Dict[str, Any]:
        """更新处理阶段状态"""
        return self.db.update_stage_status(file_id, stage, status, result, error)
    
    def get_file_record(self, file_id: str) -> Optional[Dict[str, Any]]:
        """获取文件记录"""
        return self.db.get_file_record(file_id)
    
    def get_file_status(self, file_id: str) -> Dict[str, Any]:
        """获取文件处理状态"""
        return self.db.get_file_status(file_id)
    
    def list_files(self, status: Optional[str] = None) -> list:
        """列出所有文件记录"""
        return self.db.list_files(status)
    
    def cleanup_file(self, file_id: str) -> Dict[str, Any]:
        """清理文件和相关数据"""
        # 先获取文件记录以清理物理文件
        metadata = self.db.get_file_record(file_id)
        if not metadata:
            return {"error": "文件记录不存在"}
        
        cleaned_files = []
        
        # 清理上传文件
        upload_path = Path(metadata["paths"]["upload_path"])
        if upload_path.exists():
            upload_path.unlink()
            cleaned_files.append("upload_file")
        
        # 清理输出文件
        if metadata["paths"]["markdown_path"]:
            markdown_path = Path(metadata["paths"]["markdown_path"])
            if markdown_path.exists():
                markdown_path.unlink()
                cleaned_files.append("markdown_file")
        
        # 清理数据库记录
        result = self.db.cleanup_file(file_id)
        if "error" not in result:
            cleaned_files.append("database_record")
        
        logger.info(f"清理文件: {file_id} - {cleaned_files}")
        
        return {
            "file_id": file_id,
            "cleaned_files": cleaned_files,
            "status": "cleaned"
        }
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取文件统计信息"""
        return self.db.get_statistics()
    
    def scan_directory_for_excel_files(self, directory_path: str) -> List[Dict[str, Any]]:
        """
        扫描指定目录中的Excel文件
        
        Args:
            directory_path (str): 要扫描的目录路径
            
        Returns:
            List[Dict[str, Any]]: 找到的Excel文件信息列表
        """
        directory = Path(directory_path)
        
        if not directory.exists():
            raise FileNotFoundError(f"目录不存在: {directory_path}")
        
        if not directory.is_dir():
            raise ValueError(f"路径不是目录: {directory_path}")
        
        excel_files = []
        excel_extensions = ('.xlsx', '.xls')
        
        # 递归扫描目录中的所有Excel文件
        for file_path in directory.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in excel_extensions:
                try:
                    file_info = {
                        "file_path": str(file_path),
                        "filename": file_path.name,
                        "relative_path": str(file_path.relative_to(directory)),
                        "file_size": file_path.stat().st_size,
                        "modified_time": file_path.stat().st_mtime
                    }
                    excel_files.append(file_info)
                except Exception as e:
                    logger.warning(f"无法获取文件信息 {file_path}: {e}")
                    continue
        
        logger.info(f"在目录 {directory_path} 中找到 {len(excel_files)} 个Excel文件")
        return excel_files
    
    def create_file_records_from_directory(self, directory_path: str) -> List[Dict[str, Any]]:
        """
        为目录中的Excel文件创建数据库记录
        
        Args:
            directory_path (str): 目录路径
            
        Returns:
            List[Dict[str, Any]]: 创建的文件记录列表
        """
        excel_files = self.scan_directory_for_excel_files(directory_path)
        file_records = []
        
        for file_info in excel_files:
            try:
                # 创建文件记录
                file_record = self.create_file_record(
                    file_info["filename"],
                    file_info["file_size"]
                )
                
                # 复制文件到上传目录
                source_path = Path(file_info["file_path"])
                target_path = Path(file_record["paths"]["upload_path"])
                
                # 确保目标目录存在
                target_path.parent.mkdir(parents=True, exist_ok=True)
                
                # 复制文件
                import shutil
                shutil.copy2(source_path, target_path)
                
                # 添加额外信息
                file_record["source_path"] = file_info["file_path"]
                file_record["relative_path"] = file_info["relative_path"]
                
                file_records.append(file_record)
                logger.info(f"为文件创建记录: {file_info['filename']} -> {file_record['file_id']}")
                
            except Exception as e:
                logger.error(f"为文件创建记录失败 {file_info['filename']}: {e}")
                continue
        
        return file_records
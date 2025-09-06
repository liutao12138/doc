import os
import uuid
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)

class FileManager:
    """统一管理文件生命周期和元数据"""
    
    def __init__(self, upload_dir: str = "uploads", output_dir: str = "output", metadata_dir: str = "metadata"):
        self.upload_dir = Path(upload_dir)
        self.output_dir = Path(output_dir)
        self.metadata_dir = Path(metadata_dir)
        
        # 创建必要的目录
        self.upload_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(exist_ok=True)
        self.metadata_dir.mkdir(exist_ok=True)
    
    def create_file_record(self, original_filename: str, file_size: int = 0) -> Dict[str, Any]:
        """创建文件记录"""
        file_id = str(uuid.uuid4())
        file_extension = Path(original_filename).suffix
        temp_filename = f"{file_id}{file_extension}"
        
        file_record = {
            "file_id": file_id,
            "original_filename": original_filename,
            "temp_filename": temp_filename,
            "file_size": file_size,
            "created_at": datetime.now().isoformat(),
            "status": "uploaded",
            "stages": {
                "upload": {"status": "completed", "timestamp": datetime.now().isoformat()},
                "convert": {"status": "pending", "timestamp": None},
                "vectorize": {"status": "pending", "timestamp": None}
            },
            "paths": {
                "upload_path": str(self.upload_dir / temp_filename),
                "output_path": None,
                "markdown_path": None
            },
            "metadata": {
                "document_count": 0,
                "vector_type": None,
                "processing_errors": []
            }
        }
        
        # 保存元数据
        self._save_metadata(file_id, file_record)
        logger.info(f"创建文件记录: {file_id} - {original_filename}")
        
        return file_record
    
    def update_stage_status(self, file_id: str, stage: str, status: str, 
                          result: Optional[Dict[str, Any]] = None, 
                          error: Optional[str] = None) -> Dict[str, Any]:
        """更新处理阶段状态"""
        metadata = self._load_metadata(file_id)
        if not metadata:
            raise ValueError(f"文件记录不存在: {file_id}")
        
        # 更新阶段状态
        metadata["stages"][stage]["status"] = status
        metadata["stages"][stage]["timestamp"] = datetime.now().isoformat()
        
        if result:
            metadata["stages"][stage]["result"] = result
        
        if error:
            metadata["stages"][stage]["error"] = error
            metadata["metadata"]["processing_errors"].append({
                "stage": stage,
                "error": error,
                "timestamp": datetime.now().isoformat()
            })
        
        # 更新整体状态
        if status == "completed":
            if stage == "convert" and result:
                metadata["paths"]["markdown_path"] = result.get("output_file")
                metadata["paths"]["output_path"] = result.get("output_file")
            elif stage == "vectorize" and result:
                metadata["metadata"]["document_count"] = result.get("document_count", 0)
                metadata["metadata"]["vector_type"] = result.get("vector_type")
        
        # 检查是否所有阶段都完成
        all_completed = all(
            stage_info["status"] == "completed" 
            for stage_info in metadata["stages"].values()
        )
        
        if all_completed:
            metadata["status"] = "completed"
        elif any(stage_info["status"] == "error" for stage_info in metadata["stages"].values()):
            metadata["status"] = "error"
        else:
            metadata["status"] = "processing"
        
        # 保存更新后的元数据
        self._save_metadata(file_id, metadata)
        logger.info(f"更新文件状态: {file_id} - {stage}: {status}")
        
        return metadata
    
    def get_file_record(self, file_id: str) -> Optional[Dict[str, Any]]:
        """获取文件记录"""
        return self._load_metadata(file_id)
    
    def get_file_status(self, file_id: str) -> Dict[str, Any]:
        """获取文件处理状态"""
        metadata = self._load_metadata(file_id)
        if not metadata:
            return {"error": "文件记录不存在"}
        
        return {
            "file_id": file_id,
            "status": metadata["status"],
            "stages": metadata["stages"],
            "created_at": metadata["created_at"],
            "original_filename": metadata["original_filename"]
        }
    
    def list_files(self, status: Optional[str] = None) -> list:
        """列出所有文件记录"""
        files = []
        for metadata_file in self.metadata_dir.glob("*.json"):
            try:
                with open(metadata_file, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                
                if status is None or metadata["status"] == status:
                    files.append({
                        "file_id": metadata["file_id"],
                        "original_filename": metadata["original_filename"],
                        "status": metadata["status"],
                        "created_at": metadata["created_at"],
                        "stages": metadata["stages"]
                    })
            except Exception as e:
                logger.error(f"读取元数据文件失败: {metadata_file} - {e}")
        
        return sorted(files, key=lambda x: x["created_at"], reverse=True)
    
    def cleanup_file(self, file_id: str) -> Dict[str, Any]:
        """清理文件和相关数据"""
        metadata = self._load_metadata(file_id)
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
        
        # 清理元数据文件
        metadata_file = self.metadata_dir / f"{file_id}.json"
        if metadata_file.exists():
            metadata_file.unlink()
            cleaned_files.append("metadata_file")
        
        logger.info(f"清理文件: {file_id} - {cleaned_files}")
        
        return {
            "file_id": file_id,
            "cleaned_files": cleaned_files,
            "status": "cleaned"
        }
    
    def _save_metadata(self, file_id: str, metadata: Dict[str, Any]):
        """保存元数据到文件"""
        metadata_file = self.metadata_dir / f"{file_id}.json"
        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    def _load_metadata(self, file_id: str) -> Optional[Dict[str, Any]]:
        """从文件加载元数据"""
        metadata_file = self.metadata_dir / f"{file_id}.json"
        if not metadata_file.exists():
            return None
        
        try:
            with open(metadata_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"加载元数据失败: {file_id} - {e}")
            return None

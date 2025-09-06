import os
import logging
from typing import Dict, Any, List
from celery import current_task
from app.services.vector_manager import VectorManager
from app.services.document_processor import DocumentProcessor

logger = logging.getLogger(__name__)

class VectorizationProcessor:
    def __init__(self, vector_type: str = "milvus"):
        self.vector_manager = VectorManager(vector_type)
        self.document_processor = DocumentProcessor()
    
    def process_file(self, file_path: str, file_id: str, vector_type: str = "milvus") -> Dict[str, Any]:
        """处理文件（通用方法，兼容Celery任务调用）"""
        return self.process_markdown_file(file_path, file_id)
    
    def process_markdown_file(self, markdown_path: str, file_id: str) -> Dict[str, Any]:
        try:
            logger.info(f"开始处理Markdown文件: {markdown_path}")
            
            # 读取Markdown文件
            with open(markdown_path, "r", encoding="utf-8") as f:
                markdown_content = f.read()
            
            # 转换为Document对象
            documents = self.document_processor.markdown_to_documents(
                markdown_content, 
                markdown_path
            )
            
            # 将文档添加到向量存储
            self.vector_manager.add_documents(documents)
            
            # 提取元数据
            metadata = self.document_processor.extract_metadata(markdown_content)
            
            result = {
                "file_id": file_id,
                "file_path": markdown_path,
                "status": "success",
                "document_count": len(documents),
                "metadata": metadata,
                "vector_type": self.vector_manager.vector_type
            }
            
            logger.info(f"Markdown文件处理成功: {file_id}, 文档数量: {len(documents)}")
            return result
            
        except Exception as e:
            logger.error(f"处理Markdown文件失败: {e}")
            return {
                "file_id": file_id,
                "file_path": markdown_path,
                "status": "error",
                "error": str(e)
            }
    
    def search_documents(self, query: str, top_k: int = 5, similarity_threshold: float = 0.7) -> Dict[str, Any]:
        try:
            logger.info(f"开始搜索文档: {query}")
            
            results = self.vector_manager.search(
                query=query,
                top_k=top_k,
                similarity_threshold=similarity_threshold
            )
            
            return {
                "query": query,
                "status": "success",
                "results": results,
                "total_found": len(results)
            }
            
        except Exception as e:
            logger.error(f"搜索文档失败: {e}")
            return {
                "query": query,
                "status": "error",
                "error": str(e)
            }
    
    def get_vector_stats(self) -> Dict[str, Any]:
        try:
            stats = self.vector_manager.get_stats()
            return {
                "status": "success",
                "stats": stats
            }
        except Exception as e:
            logger.error(f"获取向量统计信息失败: {e}")
            return {
                "status": "error",
                "error": str(e)
            }

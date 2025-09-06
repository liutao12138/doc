import sqlite3
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime
import threading

logger = logging.getLogger(__name__)

class DatabaseManager:
    """SQLite数据库管理器，用于文件状态持久化（单例模式）"""
    
    _instance = None
    _lock = threading.Lock()
    _initialized = False
    
    def __new__(cls, db_path: str = "file_manager.db"):
        """单例模式实现"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(DatabaseManager, cls).__new__(cls)
        return cls._instance
    
    def __init__(self, db_path: str = "file_manager.db"):
        """初始化数据库（只执行一次）"""
        if not self._initialized:
            with self._lock:
                if not self._initialized:
                    self.db_path = Path(db_path)
                    self._db_lock = threading.Lock()
                    self._init_database()
                    self._initialized = True
                    logger.info("DatabaseManager 单例实例初始化完成")
    
    def _init_database(self):
        """初始化数据库表结构"""
        with self._db_lock:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # 创建文件记录表
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS file_records (
                        file_id TEXT PRIMARY KEY,
                        original_filename TEXT NOT NULL,
                        temp_filename TEXT NOT NULL,
                        file_size INTEGER DEFAULT 0,
                        status TEXT NOT NULL DEFAULT 'uploaded',
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        upload_path TEXT,
                        output_path TEXT,
                        markdown_path TEXT,
                        document_count INTEGER DEFAULT 0,
                        vector_type TEXT,
                        processing_errors TEXT DEFAULT '[]'
                    )
                """)
                
                # 创建处理阶段表
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS file_stages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        file_id TEXT NOT NULL,
                        stage_name TEXT NOT NULL,
                        status TEXT NOT NULL,
                        timestamp TEXT,
                        result TEXT,
                        error TEXT,
                        FOREIGN KEY (file_id) REFERENCES file_records (file_id) ON DELETE CASCADE
                    )
                """)
                
                # 创建索引
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_file_status ON file_records (status)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_file_created ON file_records (created_at)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_stage_file_id ON file_stages (file_id)")
                
                conn.commit()
                logger.info("数据库初始化完成")
    
    def create_file_record(self, file_id: str, original_filename: str, temp_filename: str, 
                          file_size: int = 0, upload_path: str = None) -> Dict[str, Any]:
        """创建文件记录"""
        now = datetime.now().isoformat()
        
        with self._db_lock:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # 插入文件记录
                cursor.execute("""
                    INSERT INTO file_records 
                    (file_id, original_filename, temp_filename, file_size, status, 
                     created_at, updated_at, upload_path, processing_errors)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (file_id, original_filename, temp_filename, file_size, 'uploaded', 
                      now, now, upload_path, '[]'))
                
                # 插入初始阶段记录
                stages = [
                    ('upload', 'completed', now, None, None),
                    ('convert', 'pending', None, None, None),
                    ('vectorize', 'pending', None, None, None)
                ]
                
                for stage_name, status, timestamp, result, error in stages:
                    cursor.execute("""
                        INSERT INTO file_stages (file_id, stage_name, status, timestamp, result, error)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (file_id, stage_name, status, timestamp, result, error))
                
                conn.commit()
                logger.info(f"创建文件记录: {file_id} - {original_filename}")
        
        return self.get_file_record(file_id)
    
    def update_stage_status(self, file_id: str, stage: str, status: str, 
                           result: Optional[Dict[str, Any]] = None, 
                           error: Optional[str] = None) -> Dict[str, Any]:
        """更新处理阶段状态"""
        now = datetime.now().isoformat()
        result_json = json.dumps(result) if result else None
        
        with self._db_lock:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # 更新阶段状态
                cursor.execute("""
                    UPDATE file_stages 
                    SET status = ?, timestamp = ?, result = ?, error = ?
                    WHERE file_id = ? AND stage_name = ?
                """, (status, now, result_json, error, file_id, stage))
                
                # 更新文件记录的updated_at
                cursor.execute("""
                    UPDATE file_records 
                    SET updated_at = ?
                    WHERE file_id = ?
                """, (now, file_id))
                
                # 如果阶段完成，更新相关路径信息
                if status == "completed" and result:
                    if stage == "convert" and result.get("output_file"):
                        cursor.execute("""
                            UPDATE file_records 
                            SET markdown_path = ?, output_path = ?
                            WHERE file_id = ?
                        """, (result["output_file"], result["output_file"], file_id))
                    elif stage == "vectorize":
                        cursor.execute("""
                            UPDATE file_records 
                            SET document_count = ?, vector_type = ?
                            WHERE file_id = ?
                        """, (result.get("document_count", 0), result.get("vector_type"), file_id))
                
                # 更新整体状态
                self._update_file_status(cursor, file_id)
                
                # 如果有错误，记录到processing_errors
                if error:
                    cursor.execute("SELECT processing_errors FROM file_records WHERE file_id = ?", (file_id,))
                    errors_json = cursor.fetchone()[0] or '[]'
                    errors = json.loads(errors_json)
                    errors.append({
                        "stage": stage,
                        "error": error,
                        "timestamp": now
                    })
                    cursor.execute("""
                        UPDATE file_records 
                        SET processing_errors = ?
                        WHERE file_id = ?
                    """, (json.dumps(errors), file_id))
                
                conn.commit()
                logger.info(f"更新文件状态: {file_id} - {stage}: {status}")
        
        return self.get_file_record(file_id)
    
    def _update_file_status(self, cursor, file_id: str):
        """更新文件整体状态"""
        # 获取所有阶段状态
        cursor.execute("""
            SELECT status FROM file_stages 
            WHERE file_id = ? AND stage_name IN ('convert', 'vectorize')
        """, (file_id,))
        
        stages = [row[0] for row in cursor.fetchall()]
        
        # 确定整体状态
        if all(status == "completed" for status in stages):
            new_status = "completed"
        elif any(status == "error" for status in stages):
            new_status = "error"
        elif any(status in ["processing", "completed"] for status in stages):
            new_status = "processing"
        else:
            new_status = "uploaded"
        
        cursor.execute("""
            UPDATE file_records 
            SET status = ?
            WHERE file_id = ?
        """, (new_status, file_id))
    
    def get_file_record(self, file_id: str) -> Optional[Dict[str, Any]]:
        """获取文件记录"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # 获取文件基本信息
            cursor.execute("SELECT * FROM file_records WHERE file_id = ?", (file_id,))
            file_row = cursor.fetchone()
            
            if not file_row:
                return None
            
            # 获取阶段信息
            cursor.execute("""
                SELECT stage_name, status, timestamp, result, error 
                FROM file_stages 
                WHERE file_id = ? 
                ORDER BY stage_name
            """, (file_id,))
            
            stages = {}
            for row in cursor.fetchall():
                stages[row['stage_name']] = {
                    'status': row['status'],
                    'timestamp': row['timestamp'],
                    'result': json.loads(row['result']) if row['result'] else None,
                    'error': row['error']
                }
            
            # 构建返回数据
            record = dict(file_row)
            record['stages'] = stages
            record['paths'] = {
                'upload_path': record['upload_path'],
                'output_path': record['output_path'],
                'markdown_path': record['markdown_path']
            }
            record['metadata'] = {
                'document_count': record['document_count'],
                'vector_type': record['vector_type'],
                'processing_errors': json.loads(record['processing_errors'])
            }
            
            return record
    
    def get_file_status(self, file_id: str) -> Dict[str, Any]:
        """获取文件处理状态"""
        record = self.get_file_record(file_id)
        if not record:
            return {"error": "文件记录不存在"}
        
        return {
            "file_id": file_id,
            "status": record["status"],
            "stages": record["stages"],
            "created_at": record["created_at"],
            "original_filename": record["original_filename"]
        }
    
    def list_files(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """列出所有文件记录"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            if status:
                cursor.execute("""
                    SELECT file_id, original_filename, file_size, status, 
                           created_at, updated_at
                    FROM file_records 
                    WHERE status = ?
                    ORDER BY created_at DESC
                """, (status,))
            else:
                cursor.execute("""
                    SELECT file_id, original_filename, file_size, status, 
                           created_at, updated_at
                    FROM file_records 
                    ORDER BY created_at DESC
                """)
            
            files = []
            for row in cursor.fetchall():
                # 获取阶段信息
                cursor.execute("""
                    SELECT stage_name, status, timestamp, result, error 
                    FROM file_stages 
                    WHERE file_id = ? 
                    ORDER BY stage_name
                """, (row['file_id'],))
                
                stages = {}
                for stage_row in cursor.fetchall():
                    stages[stage_row['stage_name']] = {
                        'status': stage_row['status'],
                        'timestamp': stage_row['timestamp'],
                        'result': json.loads(stage_row['result']) if stage_row['result'] else None,
                        'error': stage_row['error']
                    }
                
                files.append({
                    "file_id": row['file_id'],
                    "filename": row['original_filename'],
                    "size": row['file_size'],
                    "status": row['status'],
                    "stages": stages,
                    "created_at": row['created_at'],
                    "updated_at": row['updated_at']
                })
            
            return files
    
    def cleanup_file(self, file_id: str) -> Dict[str, Any]:
        """清理文件记录"""
        with self._db_lock:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # 删除文件记录（级联删除阶段记录）
                cursor.execute("DELETE FROM file_records WHERE file_id = ?", (file_id,))
                
                if cursor.rowcount > 0:
                    conn.commit()
                    logger.info(f"清理文件记录: {file_id}")
                    return {
                        "file_id": file_id,
                        "status": "cleaned"
                    }
                else:
                    return {"error": "文件记录不存在"}
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取文件统计信息"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # 按状态统计
            cursor.execute("""
                SELECT status, COUNT(*) as count 
                FROM file_records 
                GROUP BY status
            """)
            status_stats = {row[0]: row[1] for row in cursor.fetchall()}
            
            # 总文件数
            cursor.execute("SELECT COUNT(*) FROM file_records")
            total_files = cursor.fetchone()[0]
            
            # 总文件大小
            cursor.execute("SELECT SUM(file_size) FROM file_records")
            total_size = cursor.fetchone()[0] or 0
            
            return {
                "total_files": total_files,
                "total_size": total_size,
                "status_breakdown": status_stats
            }

"""
WebSocket服务器，用于实时任务状态更新
"""
import asyncio
import json
import logging
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.routing import APIRouter

logger = logging.getLogger(__name__)

class ConnectionManager:
    """WebSocket连接管理器"""
    
    def __init__(self):
        # 存储所有活跃连接
        self.active_connections: Set[WebSocket] = set()
        # 存储任务订阅关系
        self.task_subscriptions: Dict[str, Set[WebSocket]] = {}
        # 存储文件订阅关系
        self.file_subscriptions: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket):
        """接受WebSocket连接"""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket连接已建立，当前连接数: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        """断开WebSocket连接"""
        self.active_connections.discard(websocket)
        
        # 清理订阅关系
        for task_id, connections in self.task_subscriptions.items():
            connections.discard(websocket)
            if not connections:
                del self.task_subscriptions[task_id]
        
        for file_id, connections in self.file_subscriptions.items():
            connections.discard(websocket)
            if not connections:
                del self.file_subscriptions[file_id]
        
        logger.info(f"WebSocket连接已断开，当前连接数: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """发送个人消息"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"发送个人消息失败: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: str):
        """广播消息给所有连接"""
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"广播消息失败: {e}")
                disconnected.add(connection)
        
        # 清理断开的连接
        for connection in disconnected:
            self.disconnect(connection)
    
    async def send_to_task_subscribers(self, task_id: str, message: str):
        """发送消息给任务订阅者"""
        if task_id in self.task_subscriptions:
            disconnected = set()
            for connection in self.task_subscriptions[task_id]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"发送任务消息失败: {e}")
                    disconnected.add(connection)
            
            # 清理断开的连接
            for connection in disconnected:
                self.disconnect(connection)
    
    async def send_to_file_subscribers(self, file_id: str, message: str):
        """发送消息给文件订阅者"""
        if file_id in self.file_subscriptions:
            disconnected = set()
            for connection in self.file_subscriptions[file_id]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"发送文件消息失败: {e}")
                    disconnected.add(connection)
            
            # 清理断开的连接
            for connection in disconnected:
                self.disconnect(connection)
    
    def subscribe_task(self, task_id: str, websocket: WebSocket):
        """订阅任务更新"""
        if task_id not in self.task_subscriptions:
            self.task_subscriptions[task_id] = set()
        self.task_subscriptions[task_id].add(websocket)
        logger.info(f"订阅任务 {task_id}，订阅者数量: {len(self.task_subscriptions[task_id])}")
    
    def unsubscribe_task(self, task_id: str, websocket: WebSocket):
        """取消订阅任务"""
        if task_id in self.task_subscriptions:
            self.task_subscriptions[task_id].discard(websocket)
            if not self.task_subscriptions[task_id]:
                del self.task_subscriptions[task_id]
            logger.info(f"取消订阅任务 {task_id}")
    
    def subscribe_file(self, file_id: str, websocket: WebSocket):
        """订阅文件更新"""
        if file_id not in self.file_subscriptions:
            self.file_subscriptions[file_id] = set()
        self.file_subscriptions[file_id].add(websocket)
        logger.info(f"订阅文件 {file_id}，订阅者数量: {len(self.file_subscriptions[file_id])}")
    
    def unsubscribe_file(self, file_id: str, websocket: WebSocket):
        """取消订阅文件"""
        if file_id in self.file_subscriptions:
            self.file_subscriptions[file_id].discard(websocket)
            if not self.file_subscriptions[file_id]:
                del self.file_subscriptions[file_id]
            logger.info(f"取消订阅文件 {file_id}")

# 创建连接管理器实例
manager = ConnectionManager()

# 创建WebSocket路由器
websocket_router = APIRouter()

@websocket_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket端点"""
    await manager.connect(websocket)
    
    try:
        while True:
            # 接收客户端消息
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # 处理不同类型的消息
            if message.get("type") == "subscribe_task":
                task_id = message.get("task_id")
                if task_id:
                    manager.subscribe_task(task_id, websocket)
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "subscription_confirmed",
                            "message": f"已订阅任务 {task_id}"
                        }),
                        websocket
                    )
            
            elif message.get("type") == "unsubscribe_task":
                task_id = message.get("task_id")
                if task_id:
                    manager.unsubscribe_task(task_id, websocket)
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "unsubscription_confirmed",
                            "message": f"已取消订阅任务 {task_id}"
                        }),
                        websocket
                    )
            
            elif message.get("type") == "subscribe_file":
                file_id = message.get("file_id")
                if file_id:
                    manager.subscribe_file(file_id, websocket)
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "subscription_confirmed",
                            "message": f"已订阅文件 {file_id}"
                        }),
                        websocket
                    )
            
            elif message.get("type") == "unsubscribe_file":
                file_id = message.get("file_id")
                if file_id:
                    manager.unsubscribe_file(file_id, websocket)
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "unsubscription_confirmed",
                            "message": f"已取消订阅文件 {file_id}"
                        }),
                        websocket
                    )
            
            elif message.get("type") == "ping":
                await manager.send_personal_message(
                    json.dumps({"type": "pong"}),
                    websocket
                )
            
            else:
                await manager.send_personal_message(
                    json.dumps({
                        "type": "error",
                        "message": "未知消息类型"
                    }),
                    websocket
                )
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket错误: {e}")
        manager.disconnect(websocket)

# 工具函数，用于发送任务更新
async def send_task_update(task_id: str, update_data: dict):
    """发送任务更新"""
    message = json.dumps({
        "type": "task_update",
        "task_id": task_id,
        "data": update_data
    })
    await manager.send_to_task_subscribers(task_id, message)

# 工具函数，用于发送文件更新
async def send_file_update(file_id: str, update_data: dict):
    """发送文件更新"""
    message = json.dumps({
        "type": "file_update",
        "file_id": file_id,
        "data": update_data
    })
    await manager.send_to_file_subscribers(file_id, message)

# 工具函数，用于广播系统消息
async def broadcast_system_message(message: str):
    """广播系统消息"""
    data = json.dumps({
        "type": "system_message",
        "message": message,
        "timestamp": asyncio.get_event_loop().time()
    })
    await manager.broadcast(data)

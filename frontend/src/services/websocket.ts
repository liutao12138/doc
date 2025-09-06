import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const wsUrl = process.env.REACT_APP_WS_URL || 'http://localhost:8000';
    
    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket连接成功');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket连接断开:', reason);
      this.handleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket连接错误:', error);
      this.handleReconnect();
    });

    this.socket.on('task_update', (data) => {
      console.log('收到任务更新:', data);
      // 触发自定义事件
      window.dispatchEvent(new CustomEvent('taskUpdate', { detail: data }));
    });

    this.socket.on('file_update', (data) => {
      console.log('收到文件更新:', data);
      // 触发自定义事件
      window.dispatchEvent(new CustomEvent('fileUpdate', { detail: data }));
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`尝试重连WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.error('WebSocket重连失败，已达到最大重试次数');
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // 订阅任务更新
  subscribeToTask(taskId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe_task', taskId);
    }
  }

  // 取消订阅任务
  unsubscribeFromTask(taskId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe_task', taskId);
    }
  }

  // 订阅文件更新
  subscribeToFile(fileId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe_file', fileId);
    }
  }

  // 取消订阅文件
  unsubscribeFromFile(fileId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe_file', fileId);
    }
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// 创建单例实例
export const wsService = new WebSocketService();

// 导出类型
export interface TaskUpdateEvent {
  task_id: string;
  state: string;
  status: string;
  progress?: number;
  message?: string;
  result?: any;
  error?: string;
}

export interface FileUpdateEvent {
  file_id: string;
  status: string;
  stages: {
    convert: {
      status: string;
      result?: any;
      error?: string;
    };
    vectorize: {
      status: string;
      result?: any;
      error?: string;
    };
  };
  updated_at: string;
}

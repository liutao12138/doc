import axios from 'axios';

// 创建axios实例
// 使用相对路径，通过package.json中的proxy配置转发到后端
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '', // 使用空字符串，让代理处理
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    console.log('API请求:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    console.log('API响应:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('响应错误:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// API接口类型定义
export interface TaskStatus {
  task_id: string;
  state: 'pending' | 'progress' | 'success' | 'failure';
  status: string;
  progress?: number;
  message?: string;
  result?: any;
  error?: string;
}

export interface FileInfo {
  file_id: string;
  filename: string;
  size: number;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
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
  created_at: string;
  updated_at: string;
}

export interface UploadResponse {
  message: string;
  task_id: string;
  file_id?: string;
  filename: string;
  status: string;
  check_status_url: string;
  file_status_url?: string;
}

export interface SearchResult {
  content: string;
  metadata: {
    file_id: string;
    filename: string;
    page_number?: number;
    section?: string;
  };
  similarity_score: number;
}

export interface SearchResponse {
  message: string;
  query: string;
  parameters: {
    top_k: number;
    similarity_threshold: number;
    vector_type: string;
  };
  results: SearchResult[];
  total_found: number;
}

export interface VectorStats {
  message: string;
  vector_type: string;
  stats: {
    total_documents: number;
    total_vectors: number;
    collection_size: number;
    last_updated: string;
  };
}

export interface DirectoryScanResponse {
  message: string;
  directory_path: string;
  file_count: number;
  files: Array<{
    file_path: string;
    filename: string;
    relative_path: string;
    file_size: number;
    modified_time: number;
  }>;
  status: string;
}

export interface DirectoryProcessResponse {
  message: string;
  task_id: string;
  file_count: number;
  file_ids: string[];
  filenames: string[];
  directory_path: string;
  status: string;
  check_status_url: string;
}

// API方法
export const apiService = {
  // 健康检查
  async healthCheck(): Promise<{ status: string; service: string }> {
    const response = await api.get('/health');
    return response.data;
  },


  // 批量上传文件
  async uploadBatchFiles(
    files: File[],
    outputDir?: string
  ): Promise<UploadResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    if (outputDir) {
      formData.append('output_dir', outputDir);
    }

    const response = await api.post('/upload-batch', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // 转换并向量化
  async convertAndVectorize(
    file: File,
    outputDir?: string,
    vectorType: string = 'milvus'
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (outputDir) {
      formData.append('output_dir', outputDir);
    }
    formData.append('vector_type', vectorType);

    const response = await api.post('/convert-and-vectorize', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // 获取任务状态
  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    const response = await api.get(`/task/${taskId}`);
    return response.data;
  },

  // 获取文件状态
  async getFileStatus(fileId: string): Promise<FileInfo> {
    const response = await api.get(`/file/${fileId}`);
    return response.data;
  },

  // 列出所有文件
  async listFiles(status?: string): Promise<{ files: FileInfo[]; count: number }> {
    const params = status ? { status } : {};
    const response = await api.get('/files', { params });
    return response.data;
  },

  // 搜索文档
  async searchDocuments(
    query: string,
    topK: number = 5,
    similarityThreshold: number = 0.7,
    vectorType: string = 'milvus'
  ): Promise<SearchResponse> {
    const response = await api.post('/search', {
      query,
      top_k: topK,
      similarity_threshold: similarityThreshold,
      vector_type: vectorType,
    });
    return response.data;
  },

  // 获取向量统计信息
  async getVectorStats(vectorType: string = 'milvus'): Promise<VectorStats> {
    const response = await api.get('/vector-stats', {
      params: { vector_type: vectorType },
    });
    return response.data;
  },

  // 下载文件
  async downloadFile(filename: string): Promise<Blob> {
    const response = await api.get(`/download/${filename}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // 清理文件
  async cleanupFile(fileId: string): Promise<{ message: string }> {
    const response = await api.delete(`/file/${fileId}`);
    return response.data;
  },

  // 清理所有文件
  async cleanupAllFiles(): Promise<{
    message: string;
    upload_files_removed: number;
    output_files_removed: number;
  }> {
    const response = await api.delete('/cleanup');
    return response.data;
  },

  // 扫描目录中的Excel文件
  async scanDirectory(directoryPath: string): Promise<DirectoryScanResponse> {
    const response = await api.get('/scan-directory', {
      params: { directory_path: directoryPath },
    });
    return response.data;
  },

  // 处理目录中的Excel文件
  async processDirectory(
    directoryPath: string,
    outputDir?: string,
    recursive: boolean = true
  ): Promise<DirectoryProcessResponse> {
    const response = await api.post('/process-directory', {
      directory_path: directoryPath,
      output_dir: outputDir,
      recursive: recursive,
    });
    return response.data;
  },
};

export default api;

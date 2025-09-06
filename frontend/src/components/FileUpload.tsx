import React, { useState, useCallback } from 'react';
import {
  Card,
  Button,
  message,
  Progress,
  Space,
  Typography,
  Select,
  Input,
  Row,
  Col,
  Tag,
  List,
  Avatar,
} from 'antd';
import {
  InboxOutlined,
  UploadOutlined,
  FileExcelOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useDropzone } from 'react-dropzone';
import { apiService, UploadResponse } from '../services/api';
import { wsService } from '../services/websocket';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface UploadTask {
  id: string;
  file: File;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  response?: UploadResponse;
  error?: string;
}

const FileUpload: React.FC = () => {
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [uploadType, setUploadType] = useState<'batch' | 'vectorize'>('batch');
  const [vectorType, setVectorType] = useState<string>('milvus');
  const [outputDir, setOutputDir] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // 批量上传文件
  const uploadBatchFiles = useCallback(async (files: File[]) => {
    const taskId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newTask: UploadTask = {
      id: taskId,
      file: files[0], // 使用第一个文件作为代表
      status: 'uploading',
      progress: 0,
      message: `正在批量上传 ${files.length} 个文件...`,
    };

    setUploadTasks(prev => [...prev, newTask]);

    try {
      const response = await apiService.uploadBatchFiles(files, outputDir || undefined);
      
      setUploadTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: 'processing', response, message: '批量上传成功，开始转换...' }
          : task
      ));

      // 订阅任务更新
      wsService.subscribeToTask(response.task_id);
      
      message.success(`批量上传成功，${files.length} 个文件转换任务已启动`);
    } catch (error: any) {
      setUploadTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: 'error', error: error.message, message: '批量上传失败' }
          : task
      ));
      throw error;
    }
  }, [outputDir]);

  // 上传并向量化
  const uploadAndVectorize = useCallback(async (file: File) => {
    const taskId = `vectorize_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newTask: UploadTask = {
      id: taskId,
      file,
      status: 'uploading',
      progress: 0,
      message: '正在上传文件并准备向量化...',
    };

    setUploadTasks(prev => [...prev, newTask]);

    try {
      const response = await apiService.convertAndVectorize(file, outputDir || undefined, vectorType);
      
      setUploadTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: 'processing', response, message: '文件上传成功，开始转换和向量化...' }
          : task
      ));

      // 订阅任务和文件更新
      wsService.subscribeToTask(response.task_id);
      if (response.file_id) {
        wsService.subscribeToFile(response.file_id);
      }
      
      message.success('文件上传成功，转换和向量化任务已启动');
    } catch (error: any) {
      setUploadTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: 'error', error: error.message, message: '上传失败' }
          : task
      ));
      throw error;
    }
  }, [outputDir, vectorType]);

  // 处理文件上传
  const handleUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);

    try {
      if (uploadType === 'batch') {
        await uploadBatchFiles(files);
      } else if (uploadType === 'vectorize' && files.length === 1) {
        await uploadAndVectorize(files[0]);
      }
    } catch (error) {
      console.error('上传失败:', error);
      message.error('上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  }, [uploadType, uploadBatchFiles, uploadAndVectorize]);

  // 文件拖拽处理
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const excelFiles = acceptedFiles.filter(file => 
      file.name.toLowerCase().endsWith('.xlsx') || 
      file.name.toLowerCase().endsWith('.xls')
    );

    if (excelFiles.length !== acceptedFiles.length) {
      message.warning('只支持Excel文件格式 (.xlsx, .xls)');
    }

    if (excelFiles.length > 0) {
      handleUpload(excelFiles);
    }
  }, [handleUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: true,
    disabled: isUploading,
  });

  // 删除任务
  const removeTask = (taskId: string) => {
    setUploadTasks(prev => prev.filter(task => task.id !== taskId));
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploading': return 'blue';
      case 'processing': return 'orange';
      case 'completed': return 'green';
      case 'error': return 'red';
      default: return 'default';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploading': return '上传中';
      case 'processing': return '处理中';
      case 'completed': return '已完成';
      case 'error': return '失败';
      default: return '未知';
    }
  };

  return (
    <div>
      <div className="page-header">
        <Title level={2} className="page-title">文件上传</Title>
        <Paragraph className="page-description">
          支持批量上传Excel文件，自动转换为Markdown格式，并可选择进行向量化处理
        </Paragraph>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          <Card 
            title="上传配置" 
            style={{ 
              marginBottom: 24,
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
            headStyle={{
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              borderRadius: '16px 16px 0 0',
              borderBottom: '1px solid rgba(102, 126, 234, 0.1)'
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>上传类型：</Text>
                <Select
                  value={uploadType}
                  onChange={setUploadType}
                  style={{ width: 200, marginLeft: 8 }}
                >
                  <Option value="batch">批量文件转换</Option>
                  <Option value="vectorize">转换并向量化</Option>
                </Select>
              </div>

              {uploadType === 'vectorize' && (
                <div>
                  <Text strong>向量数据库：</Text>
                  <Select
                    value={vectorType}
                    onChange={setVectorType}
                    style={{ width: 200, marginLeft: 8 }}
                  >
                    <Option value="milvus">Milvus</Option>
                    <Option value="elasticsearch">Elasticsearch</Option>
                  </Select>
                </div>
              )}

              <div>
                <Text strong>输出目录：</Text>
                <Input
                  placeholder="留空使用默认目录"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  style={{ width: 300, marginLeft: 8 }}
                />
              </div>
            </Space>
          </Card>

          <Card 
            title="文件上传"
            style={{ 
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
            headStyle={{
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              borderRadius: '16px 16px 0 0',
              borderBottom: '1px solid rgba(102, 126, 234, 0.1)'
            }}
          >
            <div
              {...getRootProps()}
              className={`upload-area ${isDragActive ? 'dragover' : ''}`}
              style={{ opacity: isUploading ? 0.6 : 1 }}
            >
              <input {...getInputProps()} />
              <InboxOutlined style={{ 
                fontSize: 64, 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: 24 
              }} />
              <Title level={3} style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: 600
              }}>
                {isDragActive ? '释放文件到此处' : '拖拽Excel文件到此处或点击上传'}
              </Title>
              <Paragraph style={{ 
                color: '#6b7280', 
                fontSize: '16px',
                marginBottom: 24
              }}>
                支持 .xlsx 和 .xls 格式的Excel文件（可多选）
              </Paragraph>
              <Button 
                type="primary" 
                icon={<UploadOutlined />} 
                disabled={isUploading}
                size="large"
                style={{
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
                  fontWeight: 600,
                  height: '48px',
                  padding: '0 32px'
                }}
              >
                选择文件
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card 
            title="上传说明" 
            style={{ 
              marginBottom: 24,
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
            headStyle={{
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              borderRadius: '16px 16px 0 0',
              borderBottom: '1px solid rgba(102, 126, 234, 0.1)'
            }}
          >
            <List
              size="small"
              dataSource={[
                '支持 .xlsx 和 .xls 格式',
                '单个文件最大 50MB',
                '批量上传最多 10 个文件',
                '转换过程可能需要几分钟',
                '向量化需要额外时间',
              ]}
              renderItem={(item) => (
                <List.Item style={{ 
                  padding: '12px 0',
                  borderBottom: '1px solid rgba(102, 126, 234, 0.1)'
                }}>
                  <Avatar 
                    size="small" 
                    icon={<InfoCircleOutlined />} 
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none'
                    }}
                  />
                  <span style={{ marginLeft: 12, color: '#4b5563' }}>{item}</span>
                </List.Item>
              )}
            />
          </Card>

          <Card 
            title="上传任务"
            style={{ 
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
            headStyle={{
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              borderRadius: '16px 16px 0 0',
              borderBottom: '1px solid rgba(102, 126, 234, 0.1)'
            }}
          >
            {uploadTasks.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#8c8c8c', padding: '40px 0' }}>
                暂无上传任务
              </div>
            ) : (
              <List
                size="small"
                dataSource={uploadTasks}
                renderItem={(task) => (
                  <List.Item
                    actions={[
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() => removeTask(task.id)}
                        size="small"
                      />
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<FileExcelOutlined style={{ color: '#52c41a' }} />}
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text ellipsis style={{ maxWidth: 200 }}>
                            {task.file.name}
                          </Text>
                          <Tag color={getStatusColor(task.status)}>
                            {getStatusText(task.status)}
                          </Tag>
                        </div>
                      }
                      description={
                        <div>
                          <div>{task.message}</div>
                          {task.status === 'processing' && (
                            <Progress
                              percent={task.progress}
                              size="small"
                              style={{ marginTop: 4 }}
                            />
                          )}
                          {task.error && (
                            <Text type="danger" style={{ fontSize: 12 }}>
                              {task.error}
                            </Text>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default FileUpload;

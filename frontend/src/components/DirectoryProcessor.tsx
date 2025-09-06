import React, { useState, useCallback } from 'react';
import {
  Card,
  Button,
  message,
  Space,
  Typography,
  Input,
  Row,
  Col,
  Tag,
  List,
  Avatar,
  Table,
  Switch,
  Divider,
  Alert,
  Spin,
} from 'antd';
import {
  FolderOutlined,
  SearchOutlined,
  PlayCircleOutlined,
  FileExcelOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { apiService, DirectoryScanResponse, DirectoryProcessResponse } from '../services/api';
import { wsService } from '../services/websocket';

const { Title, Text, Paragraph } = Typography;

interface DirectoryTask {
  id: string;
  directoryPath: string;
  status: 'scanning' | 'scanned' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  scanResult?: DirectoryScanResponse;
  processResult?: DirectoryProcessResponse;
  error?: string;
}

const DirectoryProcessor: React.FC = () => {
  const [directoryPath, setDirectoryPath] = useState<string>('');
  const [outputDir, setOutputDir] = useState<string>('');
  const [recursive, setRecursive] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [directoryTasks, setDirectoryTasks] = useState<DirectoryTask[]>([]);

  // 扫描目录
  const scanDirectory = useCallback(async () => {
    if (!directoryPath.trim()) {
      message.warning('请输入目录路径');
      return;
    }

    const taskId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newTask: DirectoryTask = {
      id: taskId,
      directoryPath,
      status: 'scanning',
      progress: 0,
      message: '正在扫描目录...',
    };

    setDirectoryTasks(prev => [...prev, newTask]);
    setIsScanning(true);

    try {
      const result = await apiService.scanDirectory(directoryPath);
      
      setDirectoryTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              status: 'scanned', 
              scanResult: result, 
              message: `扫描完成，找到 ${result.file_count} 个Excel文件` 
            }
          : task
      ));

      if (result.file_count === 0) {
        message.info('目录中没有找到Excel文件');
      } else {
        message.success(`扫描完成，找到 ${result.file_count} 个Excel文件`);
      }
    } catch (error: any) {
      setDirectoryTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              status: 'error', 
              error: error.message, 
              message: '扫描失败' 
            }
          : task
      ));
      message.error(`扫描失败: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  }, [directoryPath]);

  // 处理目录
  const processDirectory = useCallback(async () => {
    if (!directoryPath.trim()) {
      message.warning('请输入目录路径');
      return;
    }

    // 检查是否已经扫描过该目录
    const existingScanTask = directoryTasks.find(
      task => task.directoryPath === directoryPath && task.status === 'scanned'
    );

    if (!existingScanTask) {
      message.warning('请先扫描目录以确认文件数量');
      return;
    }

    const taskId = `process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newTask: DirectoryTask = {
      id: taskId,
      directoryPath,
      status: 'processing',
      progress: 0,
      message: '正在处理目录中的文件...',
    };

    setDirectoryTasks(prev => [...prev, newTask]);
    setIsProcessing(true);

    try {
      const result = await apiService.processDirectory(directoryPath, outputDir || undefined, recursive);
      
      setDirectoryTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              status: 'completed', 
              processResult: result, 
              message: `处理完成，${result.file_count} 个文件转换任务已启动` 
            }
          : task
      ));

      // 订阅任务更新
      wsService.subscribeToTask(result.task_id);
      
      message.success(`目录处理成功，${result.file_count} 个文件转换任务已启动`);
    } catch (error: any) {
      setDirectoryTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              status: 'error', 
              error: error.message, 
              message: '处理失败' 
            }
          : task
      ));
      message.error(`处理失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [directoryPath, outputDir, recursive, directoryTasks]);

  // 删除任务
  const removeTask = (taskId: string) => {
    setDirectoryTasks(prev => prev.filter(task => task.id !== taskId));
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scanning': return 'blue';
      case 'scanned': return 'green';
      case 'processing': return 'orange';
      case 'completed': return 'green';
      case 'error': return 'red';
      default: return 'default';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'scanning': return '扫描中';
      case 'scanned': return '已扫描';
      case 'processing': return '处理中';
      case 'completed': return '已完成';
      case 'error': return '失败';
      default: return '未知';
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // 表格列定义
  const fileColumns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      render: (text: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileExcelOutlined style={{ color: '#52c41a' }} />
          <Text ellipsis style={{ maxWidth: 200 }}>{text}</Text>
        </div>
      ),
    },
    {
      title: '相对路径',
      dataIndex: 'relative_path',
      key: 'relative_path',
      render: (text: string) => (
        <Text ellipsis style={{ maxWidth: 200, color: '#6b7280' }}>{text}</Text>
      ),
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '修改时间',
      dataIndex: 'modified_time',
      key: 'modified_time',
      render: (time: number) => formatTime(time),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2} className="page-title">目录处理</Title>
        <Paragraph className="page-description">
          扫描指定目录中的Excel文件并批量转换为Markdown格式
        </Paragraph>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          <Card 
            title="目录配置" 
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
                <Text strong>目录路径：</Text>
                <Input
                  placeholder="请输入要扫描的目录路径，如：D:\documents\excel_files"
                  value={directoryPath}
                  onChange={(e) => setDirectoryPath(e.target.value)}
                  style={{ width: '100%', marginTop: 8 }}
                  prefix={<FolderOutlined />}
                />
              </div>

              <div>
                <Text strong>输出目录：</Text>
                <Input
                  placeholder="留空使用默认输出目录"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  style={{ width: '100%', marginTop: 8 }}
                />
              </div>

              <div>
                <Text strong>递归扫描：</Text>
                <Switch
                  checked={recursive}
                  onChange={setRecursive}
                  style={{ marginLeft: 8 }}
                />
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {recursive ? '扫描子目录' : '仅扫描当前目录'}
                </Text>
              </div>

              <Divider />

              <Space>
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={scanDirectory}
                  loading={isScanning}
                  disabled={!directoryPath.trim()}
                  style={{
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
                    fontWeight: 600,
                    height: '40px',
                    padding: '0 24px'
                  }}
                >
                  扫描目录
                </Button>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={processDirectory}
                  loading={isProcessing}
                  disabled={!directoryPath.trim()}
                  style={{
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
                    fontWeight: 600,
                    height: '40px',
                    padding: '0 24px'
                  }}
                >
                  处理目录
                </Button>
                <Button
                  type="default"
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    // 直接处理，跳过扫描检查
                    const taskId = `direct_process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    
                    const newTask: DirectoryTask = {
                      id: taskId,
                      directoryPath,
                      status: 'processing',
                      progress: 0,
                      message: '正在直接处理目录中的文件...',
                    };

                    setDirectoryTasks(prev => [...prev, newTask]);
                    setIsProcessing(true);

                    apiService.processDirectory(directoryPath, outputDir || undefined, recursive)
                      .then(result => {
                        setDirectoryTasks(prev => prev.map(task => 
                          task.id === taskId 
                            ? { 
                                ...task, 
                                status: 'completed', 
                                processResult: result, 
                                message: `处理完成，${result.file_count} 个文件转换任务已启动` 
                              }
                            : task
                        ));
                        wsService.subscribeToTask(result.task_id);
                        message.success(`目录处理成功，${result.file_count} 个文件转换任务已启动`);
                      })
                      .catch(error => {
                        setDirectoryTasks(prev => prev.map(task => 
                          task.id === taskId 
                            ? { 
                                ...task, 
                                status: 'error', 
                                error: error.message, 
                                message: '处理失败' 
                              }
                            : task
                        ));
                        message.error(`处理失败: ${error.message}`);
                      })
                      .finally(() => {
                        setIsProcessing(false);
                      });
                  }}
                  loading={isProcessing}
                  disabled={!directoryPath.trim()}
                  style={{
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)',
                    fontWeight: 600,
                    height: '40px',
                    padding: '0 24px',
                    color: 'white'
                  }}
                >
                  直接处理
                </Button>
              </Space>
            </Space>
          </Card>

          {/* 扫描结果 */}
          {directoryTasks.some(task => task.status === 'scanned' && task.scanResult) && (
            <Card 
              title="扫描结果"
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
              {directoryTasks
                .filter(task => task.status === 'scanned' && task.scanResult)
                .map(task => (
                  <div key={task.id}>
                    <Alert
                      message={`目录：${task.directoryPath}`}
                      description={`找到 ${task.scanResult!.file_count} 个Excel文件`}
                      type="success"
                      showIcon
                      icon={<CheckCircleOutlined />}
                      style={{ marginBottom: 16 }}
                    />
                    <Table
                      columns={fileColumns}
                      dataSource={task.scanResult!.files}
                      rowKey="file_path"
                      pagination={{ pageSize: 10 }}
                      size="small"
                    />
                  </div>
                ))}
            </Card>
          )}
        </Col>

        <Col xs={24} lg={8}>
          <Card 
            title="使用说明" 
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
                '支持 .xlsx 和 .xls 格式的Excel文件',
                '可以递归扫描子目录',
                '一次最多处理 50 个文件',
                '建议先扫描再处理（可选）',
                '直接处理会跳过扫描步骤',
                '处理过程可能需要几分钟',
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
            title="处理任务"
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
            {directoryTasks.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#8c8c8c', padding: '40px 0' }}>
                暂无处理任务
              </div>
            ) : (
              <List
                size="small"
                dataSource={directoryTasks}
                renderItem={(task) => (
                  <List.Item
                    actions={[
                      <Button
                        type="text"
                        size="small"
                        onClick={() => removeTask(task.id)}
                      >
                        删除
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<FolderOutlined style={{ color: '#1890ff' }} />}
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text ellipsis style={{ maxWidth: 200 }}>
                            {task.directoryPath}
                          </Text>
                          <Tag color={getStatusColor(task.status)}>
                            {getStatusText(task.status)}
                          </Tag>
                        </div>
                      }
                      description={
                        <div>
                          <div>{task.message}</div>
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

export default DirectoryProcessor;

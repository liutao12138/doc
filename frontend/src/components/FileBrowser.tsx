import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Modal,
  Descriptions,
  Alert,
  Row,
  Col,
  Statistic,
  Select,
  Input,
  message,
  Tooltip,
  Progress,
  List,
  Avatar,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { apiService, FileInfo } from '../services/api';
import { wsService, FileUpdateEvent } from '../services/websocket';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

const FileBrowser: React.FC = () => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  // 获取文件列表
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiService.listFiles();
      setFiles(response.files);
    } catch (error) {
      console.error('获取文件列表失败:', error);
      message.error('获取文件列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 处理文件更新事件
  const handleFileUpdate = useCallback((event: CustomEvent<FileUpdateEvent>) => {
    const updateData = event.detail;
    setFiles(prev => prev.map(file => 
      file.file_id === updateData.file_id 
        ? { ...file, ...updateData }
        : file
    ));
  }, []);

  // 监听WebSocket事件
  useEffect(() => {
    const handleFileUpdateEvent = (event: CustomEvent<FileUpdateEvent>) => {
      handleFileUpdate(event);
    };

    window.addEventListener('fileUpdate', handleFileUpdateEvent as EventListener);
    
    return () => {
      window.removeEventListener('fileUpdate', handleFileUpdateEvent as EventListener);
    };
  }, [handleFileUpdate]);

  // 初始化
  useEffect(() => {
    fetchFiles();
    
    // 定期刷新文件列表
    const interval = setInterval(fetchFiles, 10000);
    
    return () => clearInterval(interval);
  }, [fetchFiles]);

  // 查看文件详情
  const showFileDetail = (file: FileInfo) => {
    setSelectedFile(file);
    setDetailModalVisible(true);
  };

  // 下载文件
  const downloadFile = async (filename: string) => {
    try {
      const blob = await apiService.downloadFile(filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('文件下载成功');
    } catch (error) {
      console.error('下载文件失败:', error);
      message.error('下载文件失败');
    }
  };

  // 删除文件
  const deleteFile = (fileId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个文件吗？此操作将删除所有相关数据。',
      onOk: async () => {
        try {
          await apiService.cleanupFile(fileId);
          setFiles(prev => prev.filter(file => file.file_id !== fileId));
          // 取消订阅
          wsService.unsubscribeFromFile(fileId);
          message.success('文件已删除');
        } catch (error) {
          console.error('删除文件失败:', error);
          message.error('删除文件失败');
        }
      },
    });
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusConfig = {
      uploaded: { color: 'blue', text: '已上传', icon: <ClockCircleOutlined /> },
      processing: { color: 'orange', text: '处理中', icon: <SyncOutlined spin /> },
      completed: { color: 'green', text: '已完成', icon: <CheckCircleOutlined /> },
      error: { color: 'red', text: '失败', icon: <ExclamationCircleOutlined /> },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.uploaded;
    
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 获取阶段状态
  const getStageStatus = (stage: any) => {
    if (!stage) return { color: 'default', text: '未开始' };
    
    const statusConfig = {
      pending: { color: 'default', text: '等待中' },
      processing: { color: 'processing', text: '处理中' },
      completed: { color: 'success', text: '已完成' },
      error: { color: 'error', text: '失败' },
    };

    const config = statusConfig[stage.status as keyof typeof statusConfig] || statusConfig.pending;
    return config;
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 过滤文件
  const filteredFiles = files.filter(file => {
    const matchesStatus = statusFilter === 'all' || file.status === statusFilter;
    const matchesSearch = !searchText || 
      file.file_id.toLowerCase().includes(searchText.toLowerCase()) ||
      file.filename.toLowerCase().includes(searchText.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  // 统计信息
  const stats = {
    total: files.length,
    uploaded: files.filter(f => f.status === 'uploaded').length,
    processing: files.filter(f => f.status === 'processing').length,
    completed: files.filter(f => f.status === 'completed').length,
    error: files.filter(f => f.status === 'error').length,
  };

  // 表格列定义
  const columns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      ellipsis: true,
      render: (text: string, record: FileInfo) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <Text ellipsis style={{ maxWidth: 200 }}>
            {text}
          </Text>
        </Space>
      ),
    },
    {
      title: '文件ID',
      dataIndex: 'file_id',
      key: 'file_id',
      width: 200,
      render: (text: string) => (
        <Text code style={{ fontSize: 12 }}>
          {text.substring(0, 16)}...
        </Text>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '转换状态',
      key: 'convert_status',
      width: 120,
      render: (_, record: FileInfo) => {
        const stage = record.stages?.convert;
        const config = getStageStatus(stage);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '向量化状态',
      key: 'vectorize_status',
      width: 120,
      render: (_, record: FileInfo) => {
        const stage = record.stages?.vectorize;
        const config = getStageStatus(stage);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text: string) => dayjs(text).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record: FileInfo) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => showFileDetail(record)}
              size="small"
            />
          </Tooltip>
          {record.status === 'completed' && (
            <Tooltip title="下载文件">
              <Button
                type="text"
                icon={<DownloadOutlined />}
                onClick={() => downloadFile(record.filename)}
                size="small"
              />
            </Tooltip>
          )}
          <Tooltip title="删除文件">
            <Button
              type="text"
              icon={<DeleteOutlined />}
              onClick={() => deleteFile(record.file_id)}
              size="small"
              danger
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2} className="page-title">文件浏览</Title>
        <Text className="page-description">
          查看和管理所有已上传的文件及其处理状态
        </Text>
      </div>

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总文件数"
              value={stats.total}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="已上传"
              value={stats.uploaded}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="处理中"
              value={stats.processing}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completed}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 过滤和搜索 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={8}>
            <Text strong>状态过滤：</Text>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120, marginLeft: 8 }}
            >
              <Option value="all">全部</Option>
              <Option value="uploaded">已上传</Option>
              <Option value="processing">处理中</Option>
              <Option value="completed">已完成</Option>
              <Option value="error">失败</Option>
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Search
              placeholder="搜索文件名或文件ID"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchFiles}
              loading={loading}
            >
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 文件列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredFiles}
          rowKey="file_id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 文件详情模态框 */}
      <Modal
        title="文件详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {selectedFile && (
          <div>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="文件名" span={2}>
                <Space>
                  <FileTextOutlined />
                  {selectedFile.filename}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="文件ID" span={2}>
                <Text code>{selectedFile.file_id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="文件大小">
                {formatFileSize(selectedFile.size)}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {getStatusTag(selectedFile.status)}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(selectedFile.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {dayjs(selectedFile.updated_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            <Divider>处理阶段</Divider>

            <Row gutter={16}>
              <Col span={12}>
                <Card size="small" title="转换阶段">
                  {selectedFile.stages?.convert ? (
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color={getStageStatus(selectedFile.stages.convert).color}>
                          {getStageStatus(selectedFile.stages.convert).text}
                        </Tag>
                      </div>
                      {selectedFile.stages.convert.error && (
                        <Alert
                          message={selectedFile.stages.convert.error}
                          type="error"
                          size="small"
                        />
                      )}
                      {selectedFile.stages.convert.result && (
                        <div style={{ fontSize: 12, color: '#666' }}>
                          <Text>输出文件: {selectedFile.stages.convert.result.output_file}</Text>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Text type="secondary">未开始</Text>
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="向量化阶段">
                  {selectedFile.stages?.vectorize ? (
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color={getStageStatus(selectedFile.stages.vectorize).color}>
                          {getStageStatus(selectedFile.stages.vectorize).text}
                        </Tag>
                      </div>
                      {selectedFile.stages.vectorize.error && (
                        <Alert
                          message={selectedFile.stages.vectorize.error}
                          type="error"
                          size="small"
                        />
                      )}
                      {selectedFile.stages.vectorize.result && (
                        <div style={{ fontSize: 12, color: '#666' }}>
                          <Text>向量数量: {selectedFile.stages.vectorize.result.vector_count}</Text>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Text type="secondary">未开始</Text>
                  )}
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FileBrowser;

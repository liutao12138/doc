import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Progress,
  Tooltip,
  Modal,
  Descriptions,
  Alert,
  Row,
  Col,
  Statistic,
  Select,
  Input,
  message,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { apiService, TaskStatus } from '../services/api';
import { wsService, TaskUpdateEvent } from '../services/websocket';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

interface TaskRecord extends TaskStatus {
  created_at: string;
  updated_at: string;
  filename?: string;
  file_id?: string;
}

const TaskManagement: React.FC = () => {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  // 获取任务状态
  const fetchTaskStatus = useCallback(async (taskId: string): Promise<TaskStatus | null> => {
    try {
      const status = await apiService.getTaskStatus(taskId);
      return status;
    } catch (error) {
      console.error('获取任务状态失败:', error);
      return null;
    }
  }, []);

  // 刷新任务列表
  const refreshTasks = useCallback(async () => {
    setLoading(true);
    try {
      // 这里应该从后端获取任务列表，目前使用本地存储的任务
      const storedTasks = localStorage.getItem('upload_tasks');
      if (storedTasks) {
        const taskList = JSON.parse(storedTasks);
        const updatedTasks = await Promise.all(
          taskList.map(async (task: any) => {
            if (task.task_id) {
              const status = await fetchTaskStatus(task.task_id);
              return status ? { ...task, ...status } : task;
            }
            return task;
          })
        );
        setTasks(updatedTasks);
      }
    } catch (error) {
      console.error('刷新任务列表失败:', error);
      message.error('刷新任务列表失败');
    } finally {
      setLoading(false);
    }
  }, [fetchTaskStatus]);

  // 处理任务更新事件
  const handleTaskUpdate = useCallback((event: CustomEvent<TaskUpdateEvent>) => {
    const updateData = event.detail;
    setTasks(prev => prev.map(task => 
      task.task_id === updateData.task_id 
        ? { ...task, ...updateData }
        : task
    ));
  }, []);

  // 监听WebSocket事件
  useEffect(() => {
    const handleTaskUpdateEvent = (event: CustomEvent<TaskUpdateEvent>) => {
      handleTaskUpdate(event);
    };

    window.addEventListener('taskUpdate', handleTaskUpdateEvent as EventListener);
    
    return () => {
      window.removeEventListener('taskUpdate', handleTaskUpdateEvent as EventListener);
    };
  }, [handleTaskUpdate]);

  // 初始化
  useEffect(() => {
    refreshTasks();
    
    // 定期刷新任务状态
    const interval = setInterval(refreshTasks, 5000);
    
    return () => clearInterval(interval);
  }, [refreshTasks]);

  // 查看任务详情
  const showTaskDetail = (task: TaskRecord) => {
    setSelectedTask(task);
    setDetailModalVisible(true);
  };

  // 删除任务
  const deleteTask = (taskId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个任务吗？',
      onOk: () => {
        setTasks(prev => prev.filter(task => task.task_id !== taskId));
        // 取消订阅
        wsService.unsubscribeFromTask(taskId);
        message.success('任务已删除');
      },
    });
  };

  // 获取状态标签
  const getStatusTag = (state: string) => {
    const statusConfig = {
      pending: { color: 'blue', text: '等待中', icon: <ClockCircleOutlined /> },
      progress: { color: 'orange', text: '处理中', icon: <SyncOutlined spin /> },
      success: { color: 'green', text: '已完成', icon: <CheckCircleOutlined /> },
      failure: { color: 'red', text: '失败', icon: <ExclamationCircleOutlined /> },
    };

    const config = statusConfig[state as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 过滤任务
  const filteredTasks = tasks.filter(task => {
    const matchesStatus = statusFilter === 'all' || task.state === statusFilter;
    const matchesSearch = !searchText || 
      task.task_id.toLowerCase().includes(searchText.toLowerCase()) ||
      (task.filename && task.filename.toLowerCase().includes(searchText.toLowerCase()));
    
    return matchesStatus && matchesSearch;
  });

  // 统计信息
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.state === 'pending').length,
    processing: tasks.filter(t => t.state === 'progress').length,
    completed: tasks.filter(t => t.state === 'success').length,
    failed: tasks.filter(t => t.state === 'failure').length,
  };

  // 表格列定义
  const columns = [
    {
      title: '任务ID',
      dataIndex: 'task_id',
      key: 'task_id',
      width: 200,
      render: (text: string) => (
        <Text code style={{ fontSize: 12 }}>
          {text.substring(0, 16)}...
        </Text>
      ),
    },
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      width: 120,
      render: (state: string) => getStatusTag(state),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (progress: number, record: TaskRecord) => {
        if (record.state === 'progress' && progress !== undefined) {
          return <Progress percent={progress} size="small" />;
        }
        return '-';
      },
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (text: string) => text || '-',
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
      width: 120,
      render: (_: any, record: TaskRecord) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => showTaskDetail(record)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="删除任务">
            <Button
              type="text"
              icon={<DeleteOutlined />}
              onClick={() => deleteTask(record.task_id)}
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
        <Title level={2} className="page-title">任务管理</Title>
        <Text className="page-description">
          查看和管理所有文件转换任务的状态和进度
        </Text>
      </div>

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总任务数"
              value={stats.total}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="等待中"
              value={stats.pending}
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
              <Option value="pending">等待中</Option>
              <Option value="progress">处理中</Option>
              <Option value="success">已完成</Option>
              <Option value="failure">失败</Option>
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Search
              placeholder="搜索任务ID或文件名"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={refreshTasks}
              loading={loading}
            >
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 任务列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredTasks}
          rowKey="task_id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* 任务详情模态框 */}
      <Modal
        title="任务详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {selectedTask && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="任务ID" span={2}>
              <Text code>{selectedTask.task_id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="文件名">
              {selectedTask.filename || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {getStatusTag(selectedTask.state)}
            </Descriptions.Item>
            <Descriptions.Item label="进度">
              {selectedTask.progress !== undefined ? (
                <Progress percent={selectedTask.progress} />
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="消息" span={2}>
              {selectedTask.message || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedTask.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(selectedTask.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            {selectedTask.error && (
              <Descriptions.Item label="错误信息" span={2}>
                <Alert
                  message={selectedTask.error}
                  type="error"
                  showIcon
                />
              </Descriptions.Item>
            )}
            {selectedTask.result && (
              <Descriptions.Item label="结果" span={2}>
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: 12, 
                  borderRadius: 4,
                  maxHeight: 200,
                  overflow: 'auto'
                }}>
                  {JSON.stringify(selectedTask.result, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default TaskManagement;

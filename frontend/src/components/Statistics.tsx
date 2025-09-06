import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Button,
  Space,
  Table,
  Tag,
  Progress,
  Alert,
  Spin,
  Select,
  DatePicker,
} from 'antd';
import {
  ReloadOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { apiService, VectorStats } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface SystemStats {
  totalFiles: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  vectorStats: VectorStats | null;
  recentActivity: any[];
}

const Statistics: React.FC = () => {
  const [stats, setStats] = useState<SystemStats>({
    totalFiles: 0,
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    vectorStats: null,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(false);
  const [vectorType, setVectorType] = useState('milvus');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // 获取系统统计信息
  const fetchStats = async () => {
    setLoading(true);
    try {
      // 获取文件统计
      const filesResponse = await apiService.listFiles();
      const totalFiles = filesResponse.count;
      
      // 获取向量统计
      const vectorResponse = await apiService.getVectorStats(vectorType);
      
      // 模拟任务统计（实际应该从后端获取）
      const totalTasks = 150;
      const completedTasks = 120;
      const failedTasks = 10;
      
      // 模拟最近活动
      const recentActivity = [
        {
          id: 1,
          type: 'file_upload',
          description: '用户上传了文件 "销售报告.xlsx"',
          timestamp: dayjs().subtract(5, 'minute'),
          status: 'success',
        },
        {
          id: 2,
          type: 'task_complete',
          description: '任务 "转换销售报告" 已完成',
          timestamp: dayjs().subtract(10, 'minute'),
          status: 'success',
        },
        {
          id: 3,
          type: 'vectorization',
          description: '文件 "财务数据.xlsx" 向量化完成',
          timestamp: dayjs().subtract(15, 'minute'),
          status: 'success',
        },
        {
          id: 4,
          type: 'task_failed',
          description: '任务 "转换损坏文件" 失败',
          timestamp: dayjs().subtract(20, 'minute'),
          status: 'error',
        },
        {
          id: 5,
          type: 'search',
          description: '用户搜索了 "财务报表"',
          timestamp: dayjs().subtract(25, 'minute'),
          status: 'info',
        },
      ];

      setStats({
        totalFiles,
        totalTasks,
        completedTasks,
        failedTasks,
        vectorStats: vectorResponse,
        recentActivity,
      });
    } catch (error) {
      console.error('获取统计信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [vectorType]);

  // 获取活动类型图标
  const getActivityIcon = (type: string) => {
    const iconMap = {
      file_upload: <FileTextOutlined />,
      task_complete: <CheckCircleOutlined />,
      vectorization: <DatabaseOutlined />,
      task_failed: <ExclamationCircleOutlined />,
      search: <BarChartOutlined />,
    };
    return iconMap[type as keyof typeof iconMap] || <ClockCircleOutlined />;
  };

  // 获取活动状态颜色
  const getActivityStatusColor = (status: string) => {
    const colorMap = {
      success: 'green',
      error: 'red',
      info: 'blue',
      warning: 'orange',
    };
    return colorMap[status as keyof typeof colorMap] || 'default';
  };

  // 计算成功率
  const successRate = stats.totalTasks > 0 
    ? ((stats.completedTasks / stats.totalTasks) * 100).toFixed(1)
    : '0';

  // 活动表格列定义
  const activityColumns = [
    {
      title: '活动',
      key: 'activity',
      render: (_, record: any) => (
        <Space>
          {getActivityIcon(record.type)}
          <Text>{record.description}</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getActivityStatusColor(status)}>
          {status === 'success' ? '成功' : 
           status === 'error' ? '失败' : 
           status === 'info' ? '信息' : '警告'}
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 150,
      render: (timestamp: dayjs.Dayjs) => timestamp.format('MM-DD HH:mm'),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2} className="page-title">统计信息</Title>
        <Text className="page-description">
          查看系统运行状态、处理统计和最近活动
        </Text>
      </div>

      {/* 控制面板 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={8}>
            <Text strong>向量数据库：</Text>
            <Select
              value={vectorType}
              onChange={setVectorType}
              style={{ width: 150, marginLeft: 8 }}
            >
              <Option value="milvus">Milvus</Option>
              <Option value="elasticsearch">Elasticsearch</Option>
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Text strong>时间范围：</Text>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              style={{ marginLeft: 8 }}
            />
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchStats}
              loading={loading}
            >
              刷新数据
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 基础统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总文件数"
              value={stats.totalFiles}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总任务数"
              value={stats.totalTasks}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completedTasks}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="成功率"
              value={successRate}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={24}>
        {/* 向量数据库统计 */}
        <Col xs={24} lg={12}>
          <Card title="向量数据库统计" loading={loading}>
            {stats.vectorStats ? (
              <div>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="文档总数"
                      value={stats.vectorStats.stats.total_documents}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="向量总数"
                      value={stats.vectorStats.stats.total_vectors}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                </Row>
                <div style={{ marginTop: 16 }}>
                  <Text strong>集合大小：</Text>
                  <Text style={{ marginLeft: 8 }}>
                    {stats.vectorStats.stats.collection_size} MB
                  </Text>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text strong>最后更新：</Text>
                  <Text style={{ marginLeft: 8 }}>
                    {dayjs(stats.vectorStats.stats.last_updated).format('YYYY-MM-DD HH:mm:ss')}
                  </Text>
                </div>
              </div>
            ) : (
              <Alert
                message="暂无向量数据库统计信息"
                description="请确保向量数据库已正确配置并包含数据"
                type="info"
                showIcon
              />
            )}
          </Card>
        </Col>

        {/* 任务成功率 */}
        <Col xs={24} lg={12}>
          <Card title="任务成功率">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Progress
                type="circle"
                percent={parseFloat(successRate)}
                format={(percent) => `${percent}%`}
                size={120}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">
                  已完成 {stats.completedTasks} / {stats.totalTasks} 个任务
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 最近活动 */}
      <Card title="最近活动" style={{ marginTop: 24 }}>
        <Table
          columns={activityColumns}
          dataSource={stats.recentActivity}
          rowKey="id"
          pagination={false}
          size="small"
          loading={loading}
        />
      </Card>

      {/* 系统状态 */}
      <Card title="系统状态" style={{ marginTop: 24 }}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Alert
              message="API服务"
              description="运行正常"
              type="success"
              showIcon
            />
          </Col>
          <Col xs={24} sm={8}>
            <Alert
              message="Celery Worker"
              description="运行正常"
              type="success"
              showIcon
            />
          </Col>
          <Col xs={24} sm={8}>
            <Alert
              message="向量数据库"
              description={stats.vectorStats ? "连接正常" : "连接异常"}
              type={stats.vectorStats ? "success" : "error"}
              showIcon
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Statistics;

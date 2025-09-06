import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  Select,
  Typography,
  Space,
  Divider,
  Alert,
  message,
  Row,
  Col,
  InputNumber,
  Tabs,
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  SettingOutlined,
  DatabaseOutlined,
  ApiOutlined,
  NotificationOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface SettingsData {
  api: {
    baseUrl: string;
    timeout: number;
    retryCount: number;
  };
  websocket: {
    enabled: boolean;
    url: string;
    reconnectInterval: number;
    maxReconnectAttempts: number;
  };
  vector: {
    defaultType: string;
    milvus: {
      host: string;
      port: number;
      collection: string;
    };
    elasticsearch: {
      host: string;
      port: number;
      index: string;
    };
  };
  ui: {
    autoRefresh: boolean;
    refreshInterval: number;
    pageSize: number;
    theme: string;
  };
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
  };
}

const Settings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SettingsData>({
    api: {
      baseUrl: 'http://localhost:8000',
      timeout: 30000,
      retryCount: 3,
    },
    websocket: {
      enabled: true,
      url: 'http://localhost:8000',
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
    },
    vector: {
      defaultType: 'milvus',
      milvus: {
        host: 'localhost',
        port: 19530,
        collection: 'excel_documents',
      },
      elasticsearch: {
        host: 'localhost',
        port: 9200,
        index: 'excel-documents',
      },
    },
    ui: {
      autoRefresh: true,
      refreshInterval: 5000,
      pageSize: 10,
      theme: 'light',
    },
    notifications: {
      enabled: true,
      sound: true,
      desktop: false,
    },
  });

  // 加载设置
  const loadSettings = () => {
    const savedSettings = localStorage.getItem('app_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...settings, ...parsed });
        form.setFieldsValue({ ...settings, ...parsed });
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    } else {
      form.setFieldsValue(settings);
    }
  };

  // 保存设置
  const saveSettings = async (values: SettingsData) => {
    setLoading(true);
    try {
      // 保存到本地存储
      localStorage.setItem('app_settings', JSON.stringify(values));
      setSettings(values);
      message.success('设置保存成功');
    } catch (error) {
      console.error('保存设置失败:', error);
      message.error('保存设置失败');
    } finally {
      setLoading(false);
    }
  };

  // 重置设置
  const resetSettings = () => {
    const defaultSettings: SettingsData = {
      api: {
        baseUrl: 'http://localhost:8000',
        timeout: 30000,
        retryCount: 3,
      },
      websocket: {
        enabled: true,
        url: 'http://localhost:8000',
        reconnectInterval: 3000,
        maxReconnectAttempts: 5,
      },
      vector: {
        defaultType: 'milvus',
        milvus: {
          host: 'localhost',
          port: 19530,
          collection: 'excel_documents',
        },
        elasticsearch: {
          host: 'localhost',
          port: 9200,
          index: 'excel-documents',
        },
      },
      ui: {
        autoRefresh: true,
        refreshInterval: 5000,
        pageSize: 10,
        theme: 'light',
      },
      notifications: {
        enabled: true,
        sound: true,
        desktop: false,
      },
    };
    
    setSettings(defaultSettings);
    form.setFieldsValue(defaultSettings);
    message.success('设置已重置为默认值');
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const tabItems = [
    {
      key: 'api',
      label: (
        <span>
          <ApiOutlined />
          API设置
        </span>
      ),
      children: (
        <Card>
          <Form
            form={form}
            layout="vertical"
            initialValues={settings}
            onFinish={saveSettings}
          >
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="API基础URL"
                  name={['api', 'baseUrl']}
                  rules={[{ required: true, message: '请输入API基础URL' }]}
                >
                  <Input placeholder="http://localhost:8000" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="请求超时时间(毫秒)"
                  name={['api', 'timeout']}
                  rules={[{ required: true, message: '请输入超时时间' }]}
                >
                  <InputNumber min={1000} max={60000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              label="重试次数"
              name={['api', 'retryCount']}
              rules={[{ required: true, message: '请输入重试次数' }]}
            >
              <InputNumber min={0} max={10} style={{ width: 200 }} />
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'websocket',
      label: (
        <span>
          <NotificationOutlined />
          WebSocket设置
        </span>
      ),
      children: (
        <Card>
          <Form
            form={form}
            layout="vertical"
            initialValues={settings}
            onFinish={saveSettings}
          >
            <Form.Item
              label="启用WebSocket"
              name={['websocket', 'enabled']}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="WebSocket URL"
                  name={['websocket', 'url']}
                  rules={[{ required: true, message: '请输入WebSocket URL' }]}
                >
                  <Input placeholder="http://localhost:8000" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="重连间隔(毫秒)"
                  name={['websocket', 'reconnectInterval']}
                  rules={[{ required: true, message: '请输入重连间隔' }]}
                >
                  <InputNumber min={1000} max={30000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              label="最大重连次数"
              name={['websocket', 'maxReconnectAttempts']}
              rules={[{ required: true, message: '请输入最大重连次数' }]}
            >
              <InputNumber min={1} max={20} style={{ width: 200 }} />
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'vector',
      label: (
        <span>
          <DatabaseOutlined />
          向量数据库
        </span>
      ),
      children: (
        <Card>
          <Form
            form={form}
            layout="vertical"
            initialValues={settings}
            onFinish={saveSettings}
          >
            <Form.Item
              label="默认向量数据库类型"
              name={['vector', 'defaultType']}
              rules={[{ required: true, message: '请选择向量数据库类型' }]}
            >
              <Select>
                <Option value="milvus">Milvus</Option>
                <Option value="elasticsearch">Elasticsearch</Option>
              </Select>
            </Form.Item>
            
            <Divider>Milvus配置</Divider>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="主机地址"
                  name={['vector', 'milvus', 'host']}
                  rules={[{ required: true, message: '请输入主机地址' }]}
                >
                  <Input placeholder="localhost" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="端口"
                  name={['vector', 'milvus', 'port']}
                  rules={[{ required: true, message: '请输入端口' }]}
                >
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="集合名称"
                  name={['vector', 'milvus', 'collection']}
                  rules={[{ required: true, message: '请输入集合名称' }]}
                >
                  <Input placeholder="excel_documents" />
                </Form.Item>
              </Col>
            </Row>

            <Divider>Elasticsearch配置</Divider>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="主机地址"
                  name={['vector', 'elasticsearch', 'host']}
                  rules={[{ required: true, message: '请输入主机地址' }]}
                >
                  <Input placeholder="localhost" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="端口"
                  name={['vector', 'elasticsearch', 'port']}
                  rules={[{ required: true, message: '请输入端口' }]}
                >
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="索引名称"
                  name={['vector', 'elasticsearch', 'index']}
                  rules={[{ required: true, message: '请输入索引名称' }]}
                >
                  <Input placeholder="excel-documents" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
      ),
    },
    {
      key: 'ui',
      label: (
        <span>
          <SettingOutlined />
          界面设置
        </span>
      ),
      children: (
        <Card>
          <Form
            form={form}
            layout="vertical"
            initialValues={settings}
            onFinish={saveSettings}
          >
            <Form.Item
              label="自动刷新"
              name={['ui', 'autoRefresh']}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="刷新间隔(毫秒)"
                  name={['ui', 'refreshInterval']}
                  rules={[{ required: true, message: '请输入刷新间隔' }]}
                >
                  <InputNumber min={1000} max={60000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="每页显示数量"
                  name={['ui', 'pageSize']}
                  rules={[{ required: true, message: '请输入每页显示数量' }]}
                >
                  <InputNumber min={5} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              label="主题"
              name={['ui', 'theme']}
              rules={[{ required: true, message: '请选择主题' }]}
            >
              <Select>
                <Option value="light">浅色主题</Option>
                <Option value="dark">深色主题</Option>
                <Option value="auto">跟随系统</Option>
              </Select>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'notifications',
      label: (
        <span>
          <NotificationOutlined />
          通知设置
        </span>
      ),
      children: (
        <Card>
          <Form
            form={form}
            layout="vertical"
            initialValues={settings}
            onFinish={saveSettings}
          >
            <Form.Item
              label="启用通知"
              name={['notifications', 'enabled']}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label="声音通知"
              name={['notifications', 'sound']}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label="桌面通知"
              name={['notifications', 'desktop']}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Form>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2} className="page-title">系统设置</Title>
        <Paragraph className="page-description">
          配置API连接、WebSocket设置、向量数据库和其他系统参数
        </Paragraph>
      </div>

      <Card>
        <Tabs
          defaultActiveKey="api"
          items={tabItems}
          tabPosition="top"
        />
        
        <Divider />
        
        <Row justify="space-between" align="middle">
          <Col>
            <Alert
              message="设置说明"
              description="修改设置后需要重新启动应用才能生效。部分设置会立即生效。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={resetSettings}
              >
                重置设置
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={loading}
                onClick={() => form.submit()}
              >
                保存设置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Settings;

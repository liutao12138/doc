import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Menu, Typography, Button, Space } from 'antd';
import {
  FileTextOutlined,
  UploadOutlined,
  HistoryOutlined,
  SearchOutlined,
  BarChartOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { wsService } from './services/websocket';
import FileUpload from './components/FileUpload';
import TaskManagement from './components/TaskManagement';
import FileBrowser from './components/FileBrowser';
import DocumentSearch from './components/DocumentSearch';
import Statistics from './components/Statistics';
import Settings from './components/Settings';
import './App.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  useEffect(() => {
    // 初始化WebSocket连接
    wsService.connect();

    // 组件卸载时断开连接
    return () => {
      wsService.disconnect();
    };
  }, []);

  const menuItems = [
    {
      key: '/upload',
      icon: <UploadOutlined />,
      label: '文件上传',
    },
    {
      key: '/tasks',
      icon: <HistoryOutlined />,
      label: '任务管理',
    },
    {
      key: '/files',
      icon: <FileTextOutlined />,
      label: '文件浏览',
    },
    {
      key: '/search',
      icon: <SearchOutlined />,
      label: '文档搜索',
    },
    {
      key: '/statistics',
      icon: <BarChartOutlined />,
      label: '统计信息',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
  ];

  return (
    <Layout className="app-layout">
      <Sider
        width={250}
        style={{
          background: '#fff',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="logo">
          <FileTextOutlined />
          Excel转Markdown
        </div>
        <Menu
          mode="inline"
          defaultSelectedKeys={['/upload']}
          style={{ border: 'none', marginTop: 16 }}
          items={menuItems}
          onClick={({ key }) => {
            window.location.href = key;
          }}
        />
      </Sider>
      
      <Layout>
        <Header className="app-header">
          <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
            Excel转Markdown服务
          </Title>
          <Space>
            <Button
              type="text"
              icon={wsService.isConnected() ? '🟢' : '🔴'}
              onClick={() => {
                if (wsService.isConnected()) {
                  wsService.disconnect();
                } else {
                  wsService.connect();
                }
              }}
            >
              {wsService.isConnected() ? '已连接' : '未连接'}
            </Button>
          </Space>
        </Header>
        
        <Content className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/upload" replace />} />
            <Route path="/upload" element={<FileUpload />} />
            <Route path="/tasks" element={<TaskManagement />} />
            <Route path="/files" element={<FileBrowser />} />
            <Route path="/search" element={<DocumentSearch />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;

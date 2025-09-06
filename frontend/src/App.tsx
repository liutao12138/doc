import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Button, Space } from 'antd';
import {
  FileTextOutlined,
  UploadOutlined,
  HistoryOutlined,
  SearchOutlined,
  BarChartOutlined,
  SettingOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { wsService } from './services/websocket';
import FileUpload from './components/FileUpload';
import DirectoryProcessor from './components/DirectoryProcessor';
import TaskManagement from './components/TaskManagement';
import FileBrowser from './components/FileBrowser';
import DocumentSearch from './components/DocumentSearch';
import Statistics from './components/Statistics';
import Settings from './components/Settings';
import './App.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['/upload']);

  useEffect(() => {
    // 初始化WebSocket连接
    wsService.connect();

    // 组件卸载时断开连接
    return () => {
      wsService.disconnect();
    };
  }, []);

  // 根据当前路由更新菜单选中状态
  useEffect(() => {
    setSelectedKeys([location.pathname]);
  }, [location.pathname]);

  const menuItems = [
    {
      key: '/upload',
      icon: <UploadOutlined />,
      label: '文件上传',
    },
    {
      key: '/directory',
      icon: <FolderOutlined />,
      label: '目录处理',
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
    <Layout className="app-layout" style={{ minHeight: '100vh' }}>
      <Sider
        width={250}
        className="app-sider"
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          boxShadow: '8px 0 32px rgba(0, 0, 0, 0.1)',
          borderRight: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        <div className="logo">
          <FileTextOutlined />
          Excel转Markdown
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          style={{ border: 'none', marginTop: 16 }}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key);
          }}
        />
      </Sider>
      
      <Layout className="main-layout" style={{ marginLeft: 250, minHeight: '100vh' }}>
        <Header className="app-header">
          <Title level={3} style={{ 
            margin: 0, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontWeight: 700
          }}>
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
              style={{
                borderRadius: '20px',
                background: wsService.isConnected() 
                  ? 'rgba(34, 197, 94, 0.1)' 
                  : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${wsService.isConnected() ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: wsService.isConnected() ? '#22c55e' : '#ef4444',
                fontWeight: 600
              }}
            >
              {wsService.isConnected() ? '已连接' : '未连接'}
            </Button>
          </Space>
        </Header>
        
        <Content className="app-content" style={{ flex: 1, overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/upload" replace />} />
            <Route path="/upload" element={<FileUpload />} />
            <Route path="/directory" element={<DirectoryProcessor />} />
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

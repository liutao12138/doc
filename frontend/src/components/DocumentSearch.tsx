import React, { useState, useEffect } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  List,
  Tag,
  Row,
  Col,
  Select,
  Slider,
  Divider,
  Alert,
  Empty,
  Spin,
  Tooltip,
  Statistic,
} from 'antd';
import {
  SearchOutlined,
  FileTextOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { apiService, SearchResponse, SearchResult } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;

const DocumentSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useState({
    topK: 5,
    similarityThreshold: 0.7,
    vectorType: 'milvus',
  });
  const [searchStats, setSearchStats] = useState({
    totalFound: 0,
    searchTime: 0,
    lastSearch: '',
  });

  // 执行搜索
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      return;
    }

    setLoading(true);
    setSearchQuery(query);

    try {
      const startTime = Date.now();
      const response: SearchResponse = await apiService.searchDocuments(
        query,
        searchParams.topK,
        searchParams.similarityThreshold,
        searchParams.vectorType
      );
      const endTime = Date.now();

      setSearchResults(response.results);
      setSearchStats({
        totalFound: response.total_found,
        searchTime: endTime - startTime,
        lastSearch: query,
      });
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchResults([]);
      setSearchStats({
        totalFound: 0,
        searchTime: 0,
        lastSearch: query,
      });
    } finally {
      setLoading(false);
    }
  };

  // 获取相似度颜色
  const getSimilarityColor = (score: number) => {
    if (score >= 0.8) return '#52c41a';
    if (score >= 0.6) return '#faad14';
    if (score >= 0.4) return '#fa8c16';
    return '#f5222d';
  };

  // 格式化相似度分数
  const formatSimilarityScore = (score: number) => {
    return (score * 100).toFixed(1) + '%';
  };

  // 高亮搜索关键词
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={{ backgroundColor: '#fff2b8', padding: '0 2px' }}>
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div>
      <div className="page-header">
        <Title level={2} className="page-title">文档搜索</Title>
        <Paragraph className="page-description">
          基于向量相似度搜索已处理的文档内容，支持语义搜索
        </Paragraph>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          {/* 搜索区域 */}
          <Card title="搜索设置" style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>搜索查询：</Text>
                <Search
                  placeholder="输入搜索关键词..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onSearch={handleSearch}
                  loading={loading}
                  enterButton={
                    <Button type="primary" icon={<SearchOutlined />}>
                      搜索
                    </Button>
                  }
                  style={{ marginTop: 8 }}
                />
              </div>

              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Text strong>返回结果数量：</Text>
                  <Select
                    value={searchParams.topK}
                    onChange={(value) => setSearchParams(prev => ({ ...prev, topK: value }))}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    <Option value={3}>3 个结果</Option>
                    <Option value={5}>5 个结果</Option>
                    <Option value={10}>10 个结果</Option>
                    <Option value={20}>20 个结果</Option>
                  </Select>
                </Col>
                <Col xs={24} sm={8}>
                  <Text strong>相似度阈值：</Text>
                  <div style={{ marginTop: 8 }}>
                    <Slider
                      min={0.1}
                      max={1.0}
                      step={0.1}
                      value={searchParams.similarityThreshold}
                      onChange={(value) => setSearchParams(prev => ({ ...prev, similarityThreshold: value }))}
                      marks={{
                        0.1: '0.1',
                        0.5: '0.5',
                        1.0: '1.0',
                      }}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      当前: {formatSimilarityScore(searchParams.similarityThreshold)}
                    </Text>
                  </div>
                </Col>
                <Col xs={24} sm={8}>
                  <Text strong>向量数据库：</Text>
                  <Select
                    value={searchParams.vectorType}
                    onChange={(value) => setSearchParams(prev => ({ ...prev, vectorType: value }))}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    <Option value="milvus">Milvus</Option>
                    <Option value="elasticsearch">Elasticsearch</Option>
                  </Select>
                </Col>
              </Row>
            </Space>
          </Card>

          {/* 搜索结果 */}
          <Card 
            title="搜索结果" 
            extra={
              searchStats.lastSearch && (
                <Space>
                  <Text type="secondary">
                    找到 {searchStats.totalFound} 个结果
                  </Text>
                  <Text type="secondary">
                    耗时 {searchStats.searchTime}ms
                  </Text>
                </Space>
              )
            }
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>
                  <Text>正在搜索文档...</Text>
                </div>
              </div>
            ) : searchResults.length === 0 ? (
              <Empty
                description={
                  searchStats.lastSearch 
                    ? `未找到与 "${searchStats.lastSearch}" 相关的结果`
                    : "请输入搜索关键词开始搜索"
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                dataSource={searchResults}
                renderItem={(result, index) => (
                  <List.Item key={index}>
                    <Card
                      size="small"
                      style={{ width: '100%' }}
                      title={
                        <Space>
                          <FileTextOutlined />
                          <Text ellipsis style={{ maxWidth: 300 }}>
                            {result.metadata.filename}
                          </Text>
                          <Tag 
                            color={getSimilarityColor(result.similarity_score)}
                            icon={<StarOutlined />}
                          >
                            {formatSimilarityScore(result.similarity_score)}
                          </Tag>
                        </Space>
                      }
                      extra={
                        <Space>
                          {result.metadata.page_number && (
                            <Tag>第 {result.metadata.page_number} 页</Tag>
                          )}
                          {result.metadata.section && (
                            <Tag>{result.metadata.section}</Tag>
                          )}
                        </Space>
                      }
                    >
                      <div style={{ maxHeight: 200, overflow: 'auto' }}>
                        <Paragraph>
                          {highlightText(result.content, searchQuery)}
                        </Paragraph>
                      </div>
                      <Divider style={{ margin: '12px 0' }} />
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Space size="small">
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              文件ID: {result.metadata.file_id}
                            </Text>
                          </Space>
                        </Col>
                        <Col>
                          <Tooltip title="相似度分数">
                            <Tag 
                              color={getSimilarityColor(result.similarity_score)}
                              style={{ cursor: 'help' }}
                            >
                              {formatSimilarityScore(result.similarity_score)} 相似度
                            </Tag>
                          </Tooltip>
                        </Col>
                      </Row>
                    </Card>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          {/* 搜索统计 */}
          <Card title="搜索统计" style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="总结果数"
                  value={searchStats.totalFound}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="搜索耗时"
                  value={searchStats.searchTime}
                  suffix="ms"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>
          </Card>

          {/* 搜索说明 */}
          <Card title="搜索说明">
            <List
              size="small"
              dataSource={[
                '支持语义搜索，理解查询意图',
                '基于向量相似度匹配内容',
                '相似度分数越高，匹配度越好',
                '可调整相似度阈值过滤结果',
                '支持多语言内容搜索',
                '搜索结果按相似度排序',
              ]}
              renderItem={(item) => (
                <List.Item>
                  <InfoCircleOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                  {item}
                </List.Item>
              )}
            />
          </Card>

          {/* 搜索提示 */}
          <Card title="搜索提示" style={{ marginTop: 24 }}>
            <Alert
              message="搜索建议"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>使用具体的关键词而不是模糊描述</li>
                  <li>尝试不同的表达方式</li>
                  <li>调整相似度阈值获得更多或更精确的结果</li>
                  <li>结合文件名和内容进行搜索</li>
                </ul>
              }
              type="info"
              showIcon
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DocumentSearch;

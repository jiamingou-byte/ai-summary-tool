import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ZhipuAI } from 'zhipuai';
import { Client } from '@notionhq/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 预设标签库
const presetTags = {
  // 领域标签
  领域: [
    '技术', '商业', '教育', '健康', '生活', '职场',
    '创业', '投资', '营销', '管理', '科技', '文化',
    '艺术', '体育', '娱乐', '旅游', '美食', '时尚'
  ],
  // 主题标签
  主题: [
    '效率', '学习', '成长', '创新', '沟通', '领导力',
    '团队', '目标', '时间管理', '决策', '思维', '习惯',
    '心态', '人际关系', '自我提升', '职业发展', '财务', '健康'
  ],
  // 方法标签
  方法: [
    '工具', '技巧', '策略', '框架', '模型', '方法',
    '步骤', '流程', '系统', '规划', '执行', '评估'
  ]
};

// 标签标准化映射
const tagMapping = {
  'tech': '技术',
  'technology': '技术',
  'business': '商业',
  'education': '教育',
  'health': '健康',
  'life': '生活',
  'workplace': '职场',
  'career': '职场',
  'startup': '创业',
  'investment': '投资',
  'marketing': '营销',
  'management': '管理',
  'science': '科技',
  'culture': '文化',
  'art': '艺术',
  'sports': '体育',
  'entertainment': '娱乐',
  'travel': '旅游',
  'food': '美食',
  'fashion': '时尚',
  'efficiency': '效率',
  'learning': '学习',
  'growth': '成长',
  'innovation': '创新',
  'communication': '沟通',
  'leadership': '领导力',
  'team': '团队',
  'goal': '目标',
  'time management': '时间管理',
  'decision making': '决策',
  'thinking': '思维',
  'habit': '习惯',
  'mindset': '心态',
  'relationship': '人际关系',
  'self improvement': '自我提升',
  'professional development': '职业发展',
  'finance': '财务',
  'health': '健康',
  'tool': '工具',
  'skill': '技巧',
  'strategy': '策略',
  'framework': '框架',
  'model': '模型',
  'method': '方法',
  'step': '步骤',
  'process': '流程',
  'system': '系统',
  'planning': '规划',
  'execution': '执行',
  'evaluation': '评估'
};

// 标准化标签函数
function standardizeTags(tags) {
  return tags.map(tag => {
    // 去除前后空格，转小写
    const normalizedTag = tag.trim().toLowerCase();
    
    // 检查映射表
    if (tagMapping[normalizedTag]) {
      return tagMapping[normalizedTag];
    }
    
    // 检查预设标签库
    for (const category in presetTags) {
      for (const presetTag of presetTags[category]) {
        if (presetTag.toLowerCase() === normalizedTag) {
          return presetTag;
        }
      }
    }
    
    // 保留原始标签
    return tag.trim();
  }).filter((tag, index, self) => tag && self.indexOf(tag) === index); // 去重
}

// 生成推荐标签
function generateRecommendedTags(content) {
  const allPresetTags = Object.values(presetTags).flat();
  const recommended = [];
  
  // 简单的关键词匹配
  for (const tag of allPresetTags) {
    if (content.toLowerCase().includes(tag.toLowerCase())) {
      recommended.push(tag);
    }
  }
  
  return recommended.slice(0, 5); // 最多返回5个推荐标签
}

// 加载环境变量
dotenv.config();

// 获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建上传目录
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持JPG、PNG、WebP格式的图片'));
    }
  }
});

// 初始化Express
const app = express();
app.use(cors());
app.use(express.json());

// 初始化智谱AI客户端
const zhipuai = new ZhipuAI({
  apiKey: process.env.ZHIPUAI_API_KEY
});

// 初始化Notion客户端
const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

// URL内容提取API
app.post('/api/extract-url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: '请提供URL' });
    }

    // 验证URL格式
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'URL格式无效' });
    }

    // 发送HTTP请求获取网页内容
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 提取标题
    let title = $('title').text().trim();
    if (!title) {
      title = $('h1').first().text().trim();
    }

    // 提取正文内容 - 尝试多种选择器
    let content = '';
    
    // 微信文章特定选择器
    const wechatContent = $('#js_content').text().trim();
    if (wechatContent) {
      content = wechatContent;
    } else {
      // 尝试常见的正文容器
      const selectors = [
        'article',
        '.article-content',
        '.post-content',
        '.content',
        'main',
        '#content',
        '.entry-content'
      ];
      
      for (const selector of selectors) {
        const el = $(selector);
        if (el.length > 0) {
          content = el.text().trim();
          if (content.length > 100) {
            break;
          }
        }
      }
      
      // 如果上述都不行，提取所有段落
      if (!content || content.length < 100) {
        const paragraphs = [];
        $('p').each((i, el) => {
          const text = $(el).text().trim();
          if (text.length > 20) {
            paragraphs.push(text);
          }
        });
        content = paragraphs.join('\n\n');
      }
    }

    // 清理内容
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    if (!content || content.length < 50) {
      return res.status(400).json({ error: '无法从该URL提取有效内容' });
    }

    res.json({
      title,
      content,
      url
    });
  } catch (error) {
    console.error('URL提取失败:', error);
    
    if (error.response) {
      res.status(error.response.status).json({ error: `无法访问该网站 (${error.response.status})` });
    } else if (error.code === 'ECONNABORTED') {
      res.status(408).json({ error: '请求超时，请稍后重试' });
    } else {
      res.status(500).json({ error: 'URL内容提取失败，请稍后重试' });
    }
  }
});

// 图片内容提取API
app.post('/api/extract-image', upload.single('image'), async (req, res) => {
  console.log('收到图片提取请求');
  try {
    if (!req.file) {
      console.log('没有收到图片文件');
      return res.status(400).json({ error: '请上传图片' });
    }

    console.log('收到图片文件:', req.file.originalname);
    console.log('文件路径:', req.file.path);
    console.log('文件大小:', req.file.size);
    console.log('文件类型:', req.file.mimetype);

    // 读取图片文件
    const imagePath = req.file.path;
    let imageBuffer;
    try {
      imageBuffer = fs.readFileSync(imagePath);
      console.log('图片文件读取成功，大小:', imageBuffer.length);
    } catch (readError) {
      console.error('读取图片文件失败:', readError);
      // 清理临时文件
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error('清理临时文件失败:', e);
        }
      }
      return res.status(500).json({ error: '读取图片文件失败' });
    }

    const base64Image = imageBuffer.toString('base64');
    console.log('图片转换为base64成功，长度:', base64Image.length);

    // 调用智谱AI进行OCR
    console.log('开始调用智谱AI API');
    let response;
    try {
      // 构建正确的消息格式 - 使用glm-4v模型的多模态输入格式
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请提取图片中的所有文字内容，保持原始格式'
            },
            {
              type: 'image',
              image: base64Image
            }
          ]
        }
      ];
      
      response = await zhipuai.chat.completions.create({
        model: 'glm-4v', // 使用glm-4v模型
        messages: messages,
        temperature: 0.1
      });
      console.log('智谱AI API调用成功');
    } catch (apiError) {
      console.error('智谱AI API调用失败:', apiError);
      // 清理临时文件
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error('清理临时文件失败:', e);
        }
      }
      return res.status(500).json({ error: 'AI服务调用失败，请稍后重试' });
    }

    // 提取OCR结果
    const ocrResult = response.choices[0].message.content;
    console.log('OCR结果长度:', ocrResult ? ocrResult.length : 0);

    // 清理临时文件
    try {
      fs.unlinkSync(imagePath);
      console.log('临时文件清理成功');
    } catch (unlinkError) {
      console.error('清理临时文件失败:', unlinkError);
    }

    if (!ocrResult || ocrResult.length < 10) {
      console.log('OCR结果为空或长度不足');
      return res.status(400).json({ error: '无法从图片中提取有效内容' });
    }

    console.log('图片提取成功，返回结果');
    res.json({
      content: ocrResult
    });
  } catch (error) {
    console.error('图片提取失败:', error);
    
    // 清理临时文件
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('清理临时文件失败:', e);
      }
    }

    res.status(500).json({ error: '图片内容提取失败，请稍后重试' });
  }
});

// 分析API
app.post('/api/analyze', async (req, res) => {
  try {
    const { text, note } = req.body;
    
    // 调用智谱AI大模型
    const response = await zhipuai.chat.completions.create({
      model: 'glm-4',
      messages: [
        {
          role: 'system',
          content: '你是一个"认知压缩与结构化专家"。用户会输入一段信息，你的任务是将其转化为"可以长期复用的知识卡片"。\n\n要求：\n- 不要输出空话\n- 不要泛化\n- 重点在"可复用"和"可调用"\n- 标题要简洁明了，概括核心内容，控制在20字以内\n- 核心认知要提炼为一句"可迁移"的结论，避免复述原文\n- 本质解释控制在1-2句话\n- 适用场景必须具体（例如：做项目规划 / 用户分析 / 决策时）\n- 关键信息要提取内容中的重要信息点，不限制个数\n- 主题标签要分析内容的主要主题和领域，用简洁的词语描述'
        },
        {
          role: 'user',
          content: `请分析以下内容，严格按照以下格式输出：\n\n1. 标题：\n- 简洁明了，概括核心内容\n- 控制在20字以内\n\n2. 核心认知：\n- 提炼为一句"可迁移"的结论\n- 避免复述原文\n\n3. 本质解释：\n- 简要说明为什么这个认知成立\n- 控制在1-2句话\n\n4. 适用场景：\n- 描述在什么具体情况下可以用到这个认知\n- 必须具体（例如：做项目规划 / 用户分析 / 决策时）\n\n5. 关键信息：\n- 提取内容中的重要信息点\n- 不限制个数，每个信息点单独一行\n\n6. 主题标签：\n- 分析内容的主要主题和领域\n- 用简洁的词语描述，多个标签用逗号分隔\n\n内容：${text}${note ? `\n\n用户的笔记（供参考）：${note}` : ''}`
        }
      ],
      temperature: 0.7
    });

    // 解析AI返回的结果
    const aiResponse = response.choices[0].message.content;
    console.log('AI响应:', aiResponse);
    
    // 提取标题、核心认知、本质解释、适用场景、关键信息和主题标签
    // 新的输出格式
    const titleMatch = aiResponse.match(/1\. 标题：[\s\S]*?(?=2\. 核心认知：|$)/) || 
                      aiResponse.match(/标题：[\s\S]*?(?=核心认知：|$)/);
    const coreCognitionMatch = aiResponse.match(/2\. 核心认知：[\s\S]*?(?=3\. 本质解释：|$)/) || 
                              aiResponse.match(/核心认知：[\s\S]*?(?=本质解释：|$)/);
    const coreInsightsMatch = aiResponse.match(/3\. 本质解释：[\s\S]*?(?=4\. 适用场景：|$)/) || 
                             aiResponse.match(/本质解释：[\s\S]*?(?=适用场景：|$)/);
    const applicableScenariosMatch = aiResponse.match(/4\. 适用场景：[\s\S]*?(?=5\. 关键信息：|$)/) || 
                                     aiResponse.match(/适用场景：[\s\S]*?(?=关键信息：|$)/);
    const keyInformationMatch = aiResponse.match(/5\. 关键信息：[\s\S]*?(?=6\. 主题标签：|$)/) || 
                               aiResponse.match(/关键信息：[\s\S]*?(?=主题标签：|$)/);
    const topicTagsMatch = aiResponse.match(/6\. 主题标签：[\s\S]*?(?=$)/) || 
                          aiResponse.match(/主题标签：[\s\S]*/);
    
    console.log('标题匹配:', titleMatch);
    console.log('核心认知匹配:', coreCognitionMatch);
    console.log('本质解释匹配:', coreInsightsMatch);
    console.log('适用场景匹配:', applicableScenariosMatch);
    console.log('关键信息匹配:', keyInformationMatch);
    console.log('主题标签匹配:', topicTagsMatch);

    // 处理提取的内容
    // 标题：简洁明了，概括核心内容
    const title = titleMatch ? 
      titleMatch[0].replace(/(1\. )?标题：/, '').trim().replace(/^-\s*/, '') : 
      '暂无标题';
    
    // 核心认知：一句"可迁移"的结论
    const summary = coreCognitionMatch ? 
      coreCognitionMatch[0].replace(/(2\. )?核心认知：/, '').trim().replace(/^-\s*/, '') : 
      '暂无核心认知';
    
    // 本质解释：为什么这个认知成立
    const coreInsights = coreInsightsMatch ? 
      coreInsightsMatch[0].replace(/(3\. )?本质解释：/, '').trim().replace(/^-\s*/, '') : 
      '';
    
    // 适用场景：具体情况下可以用到这个认知
    const applicableScenarios = applicableScenariosMatch ? 
      applicableScenariosMatch[0].replace(/(4\. )?适用场景：/, '').trim().replace(/^-\s*/, '') : 
      '';
    
    // 关键信息：提取内容中的重要信息点
    const keyInformation = keyInformationMatch ? 
      keyInformationMatch[0].replace(/(5\. )?关键信息：/, '').trim().split('\n').filter(item => item.trim()).map(item => item.replace(/^-\s*/, '')) : 
      [];
    
    // 主题标签：分析内容的主要主题和领域
    const rawTags = topicTagsMatch ? 
      topicTagsMatch[0].replace(/(6\. )?主题标签：/, '').trim().split(',').map(tag => tag.trim().replace(/^-\s*/, '')).filter(tag => tag) : 
      [];
    
    // 标准化标签
    const topicTags = standardizeTags(rawTags);
    
    console.log('标题:', title);
    console.log('核心认知:', summary);
    console.log('本质解释:', coreInsights);
    console.log('适用场景:', applicableScenarios);
    console.log('关键信息:', keyInformation);
    console.log('主题标签:', topicTags);

    // 为了兼容性，保留原有的字段结构
    const corePoints = coreCognitionMatch ? 
      coreCognitionMatch[0].replace(/(2\. )?核心认知：/, '').trim().split('\n').filter(item => item.trim()).map(item => item.replace(/^-\s*/, '')) : 
      [];
    
    const importance = coreInsightsMatch ? 
      coreInsightsMatch[0].replace(/(3\. )?本质解释：/, '').trim().split('\n').filter(item => item.trim()).map(item => item.replace(/^-\s*/, '')) : 
      [];
    
    const actionSuggestions = applicableScenariosMatch ? 
      applicableScenariosMatch[0].replace(/(4\. )?适用场景：/, '').trim().split('\n').filter(item => item.trim()).map(item => item.replace(/^-\s*/, '')) : 
      [];

    // 生成推荐标签
    const recommendedTags = generateRecommendedTags(text);
    
    // 构建分析结果
    const result = {
      title,            // 标题：简洁明了的总结
      summary,           // 核心认知：一句话总结
      coreInsights,     // 本质解释
      applicableScenarios, // 适用场景
      keyInformation,   // 关键信息
      topicTags,        // 主题标签
      recommendedTags,  // 推荐标签
      corePoints,       // 核心观点（保持兼容性）
      importance,        // 为什么重要（保持兼容性）
      actionSuggestions  // 行动建议（保持兼容性）
    };

    res.json(result);
  } catch (error) {
    console.error('AI分析失败:', error);
    res.status(500).json({ error: 'AI分析失败，请稍后重试' });
  }
});

// 保存到Notion API
app.post('/api/save-to-notion', async (req, res) => {
  try {
    const { record } = req.body;

    // 保存到Notion数据库
    const notionPage = await notion.pages.create({
      parent: {
        database_id: process.env.NOTION_DATABASE_ID
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: record.result.title || record.input
              }
            }
          ]
        },
        timestamp: {
          date: {
            start: new Date().toISOString()
          }
        }
      },
      // 将所有内容保存到页面的主体部分
      children: [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '标题'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: record.result.title || '暂无标题'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '核心观点'
                }
              }
            ]
          }
        },
        ...record.result.corePoints.map(point => ({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: point
                }
              }
            ]
          }
        })),
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '为什么重要'
                }
              }
            ]
          }
        },
        ...record.result.importance.map(item => ({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: item
                }
              }
            ]
          }
        })),
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '行动建议'
                }
              }
            ]
          }
        },
        ...record.result.actionSuggestions.map(suggestion => ({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: suggestion
                }
              }
            ]
          }
        })),
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '关键信息'
                }
              }
            ]
          }
        },
        ...(record.result.keyInformation || []).map(info => ({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: info
                }
              }
            ]
          }
        })),
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '主题标签'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: (record.result.topicTags || []).join(' · ')
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '原文内容'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: record.fullInput || '暂无原文内容'
                }
              }
            ]
          }
        }
      ]
    });

    res.json({ success: true, pageId: notionPage.id });
  } catch (error) {
    console.error('保存到Notion失败:', error);
    res.status(500).json({ error: '保存到Notion失败，请稍后重试' });
  }
});

// 删除Notion记录API
app.delete('/api/delete-from-notion', async (req, res) => {
  try {
    const { pageId } = req.body;

    // 删除Notion页面
    await notion.pages.update({
      page_id: pageId,
      archived: true
    });

    res.json({ success: true });
  } catch (error) {
    console.error('删除Notion记录失败:', error);
    res.status(500).json({ error: '删除Notion记录失败，请稍后重试' });
  }
});

// 获取完整标签库API
app.get('/api/tags', async (req, res) => {
  try {
    res.json({
      tags: presetTags,
      allTags: Object.values(presetTags).flat()
    });
  } catch (error) {
    console.error('获取标签库失败:', error);
    res.status(500).json({ error: '获取标签库失败，请稍后重试' });
  }
});

// 启动服务器
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`后端服务器运行在 http://localhost:${PORT}`);
});
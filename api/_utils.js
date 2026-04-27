import { ZhipuAI } from 'zhipuai';
import { Client } from '@notionhq/client';
import axios from 'axios';
import * as cheerio from 'cheerio';

// 预设标签库
export const presetTags = {
  领域: [
    '技术', '商业', '教育', '健康', '生活', '职场',
    '创业', '投资', '营销', '管理', '科技', '文化',
    '艺术', '体育', '娱乐', '旅游', '美食', '时尚'
  ],
  主题: [
    '效率', '学习', '成长', '创新', '沟通', '领导力',
    '团队', '目标', '时间管理', '决策', '思维', '习惯',
    '心态', '人际关系', '自我提升', '职业发展', '财务', '健康'
  ],
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
export function standardizeTags(tags) {
  return tags.map(tag => {
    const normalizedTag = tag.trim().toLowerCase();
    if (tagMapping[normalizedTag]) {
      return tagMapping[normalizedTag];
    }
    for (const category in presetTags) {
      for (const presetTag of presetTags[category]) {
        if (presetTag.toLowerCase() === normalizedTag) {
          return presetTag;
        }
      }
    }
    return tag.trim();
  }).filter((tag, index, self) => tag && self.indexOf(tag) === index);
}

// 生成推荐标签
export function generateRecommendedTags(content) {
  const allPresetTags = Object.values(presetTags).flat();
  const recommended = [];
  for (const tag of allPresetTags) {
    if (content.toLowerCase().includes(tag.toLowerCase())) {
      recommended.push(tag);
    }
  }
  return recommended.slice(0, 5);
}

// 初始化智谱AI客户端
const zhipuApiKey = process.env.ZHIPUAI_API_KEY || process.env.VITE_ZHIPUAI_API_KEY;
export const zhipuai = new ZhipuAI({
  apiKey: zhipuApiKey
});

// 初始化Notion客户端
const notionApiKey = process.env.NOTION_API_KEY || process.env.VITE_NOTION_API_KEY;
export const notion = new Client({
  auth: notionApiKey
});

export const notionDatabaseId = process.env.NOTION_DATABASE_ID || process.env.VITE_NOTION_DATABASE_ID;

// URL内容提取函数
export async function extractUrlContent(url) {
  try {
    new URL(url);
  } catch (e) {
    throw new Error('URL格式无效');
  }

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 30000
  });

  const html = response.data;
  const $ = cheerio.load(html);

  let title = $('title').text().trim();
  if (!title) {
    title = $('h1').first().text().trim();
  }

  let content = '';
  const wechatContent = $('#js_content').text().trim();
  if (wechatContent) {
    content = wechatContent;
  } else {
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

  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  if (!content || content.length < 50) {
    throw new Error('无法从该URL提取有效内容');
  }

  return { title, content, url };
}
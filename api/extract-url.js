import { extractUrlContent } from './_utils';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: '请提供URL' });
    }

    const result = await extractUrlContent(url);
    res.json(result);
  } catch (error) {
    console.error('URL提取失败:', error);
    
    if (error.response) {
      res.status(error.response.status).json({ error: `无法访问该网站 (${error.response.status})` });
    } else if (error.code === 'ECONNABORTED') {
      res.status(408).json({ error: '请求超时，请稍后重试' });
    } else {
      res.status(500).json({ error: error.message || 'URL内容提取失败，请稍后重试' });
    }
  }
}
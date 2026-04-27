import { presetTags } from './_utils';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    res.json({
      tags: presetTags,
      allTags: Object.values(presetTags).flat()
    });
  } catch (error) {
    console.error('获取标签库失败:', error);
    res.status(500).json({ error: '获取标签库失败，请稍后重试' });
  }
}
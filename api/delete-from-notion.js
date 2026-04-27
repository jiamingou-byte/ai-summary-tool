import { notion } from './_utils';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pageId } = req.body;

    await notion.pages.update({
      page_id: pageId,
      archived: true
    });

    res.json({ success: true });
  } catch (error) {
    console.error('删除Notion记录失败:', error);
    res.status(500).json({ error: '删除Notion记录失败，请稍后重试' });
  }
}
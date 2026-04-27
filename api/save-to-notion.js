import { getNotionClient, getNotionDatabaseId } from './_utils';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { record } = req.body;
    const notion = getNotionClient();
    const notionDatabaseId = getNotionDatabaseId();

    const notionPage = await notion.pages.create({
      parent: {
        database_id: notionDatabaseId
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
}
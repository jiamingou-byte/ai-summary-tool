import { getZhipuaiClient, standardizeTags, generateRecommendedTags } from './_utils';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, note } = req.body;
    const zhipuai = getZhipuaiClient();
    
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

    const aiResponse = response.choices[0].message.content;
    
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

    const title = titleMatch ? 
      titleMatch[0].replace(/(1\. )?标题：/, '').trim().replace(/^-\s*/, '') : 
      '暂无标题';
    
    const summary = coreCognitionMatch ? 
      coreCognitionMatch[0].replace(/(2\. )?核心认知：/, '').trim().replace(/^-\s*/, '') : 
      '暂无核心认知';
    
    const coreInsights = coreInsightsMatch ? 
      coreInsightsMatch[0].replace(/(3\. )?本质解释：/, '').trim().replace(/^-\s*/, '') : 
      '';
    
    const applicableScenarios = applicableScenariosMatch ? 
      applicableScenariosMatch[0].replace(/(4\. )?适用场景：/, '').trim().replace(/^-\s*/, '') : 
      '';
    
    const keyInformation = keyInformationMatch ? 
      keyInformationMatch[0].replace(/(5\. )?关键信息：/, '').trim().split('\n').filter(item => item.trim()).map(item => item.replace(/^-\s*/, '')) : 
      [];
    
    const rawTags = topicTagsMatch ? 
      topicTagsMatch[0].replace(/(6\. )?主题标签：/, '').trim().split(',').map(tag => tag.trim().replace(/^-\s*/, '')).filter(tag => tag) : 
      [];
    
    const topicTags = standardizeTags(rawTags);
    
    const corePoints = coreCognitionMatch ? 
      coreCognitionMatch[0].replace(/(2\. )?核心认知：/, '').trim().split('\n').filter(item => item.trim()).map(item => item.replace(/^-\s*/, '')) : 
      [];
    
    const importance = coreInsightsMatch ? 
      coreInsightsMatch[0].replace(/(3\. )?本质解释：/, '').trim().split('\n').filter(item => item.trim()).map(item => item.replace(/^-\s*/, '')) : 
      [];
    
    const actionSuggestions = applicableScenariosMatch ? 
      applicableScenariosMatch[0].replace(/(4\. )?适用场景：/, '').trim().split('\n').filter(item => item.trim()).map(item => item.replace(/^-\s*/, '')) : 
      [];

    const recommendedTags = generateRecommendedTags(text);
    
    const result = {
      title,
      summary,
      coreInsights,
      applicableScenarios,
      keyInformation,
      topicTags,
      recommendedTags,
      corePoints,
      importance,
      actionSuggestions
    };

    res.json(result);
  } catch (error) {
    console.error('AI分析失败:', error);
    res.status(500).json({ error: 'AI分析失败，请稍后重试' });
  }
}
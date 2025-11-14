// api/verify-news.js
export default async function handler(req, res) {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // 只处理POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { content, source } = req.body;
    
    if (!content || !source) {
      return res.status(400).json({ error: 'Content and source are required' });
    }

    // 从环境变量获取API密钥 - 使用和你grade-essay.js相同的命名
    const API_KEY = process.env.QIANFAN_API_KEY;
    const APP_ID = process.env.QIANFAN_APP_ID;
    
    console.log('环境变量检查:', { 
      hasApiKey: !!API_KEY, 
      hasAppId: !!APP_ID 
    });
    
    if (!API_KEY || !APP_ID) {
      console.error('环境变量缺失');
      return res.status(500).json({ 
        error: 'API credentials not configured',
        details: {
          hasApiKey: !!API_KEY,
          hasAppId: !!APP_ID
        }
      });
    }

    console.log('准备调用千帆API...');
    
    // 构建提示词
    const prompt = `You are a professional fake news verification expert. Please analyze the following information using the SIFT four-step verification method:

Information: "${content}"
Source: "${source}"

Please respond in English with JSON format containing these fields:
- sift_analysis: {stop, investigate_source, find_coverage, trace_claims}
- credibility_rating: string
- final_advice: string  
- learning_tips: string

Make the analysis detailed and educational.`;

    const requestBody = {
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    };

    console.log('发送请求到千帆API...');
    
    // 调用百度千帆API - 使用和你grade-essay.js相同的认证方式
    const response = await fetch('https://qianfan.baidubce.com/v2/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': API_KEY,
        'appid': APP_ID
      },
      body: JSON.stringify(requestBody)
    });

    console.log('千帆API响应状态:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('千帆API错误详情:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText
      });
      
      return res.status(500).json({ 
        error: `API request failed with status ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    console.log('千帆API成功响应');
    
    // 解析AI回复
    let aiResponse;
    try {
      const aiContent = data.choices[0].message.content;
      console.log('AI原始回复:', aiContent);
      
      // 尝试从回复中提取JSON
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        // 如果无法解析为JSON，使用默认回复
        console.log('无法解析JSON，使用默认回复');
        aiResponse = createDefaultResponse(aiContent, source);
      }
    } catch (parseError) {
      console.error('解析AI回复失败:', parseError);
      aiResponse = createDefaultResponse(data.choices[0].message.content, source);
    }

    // 添加原始内容到响应中
    aiResponse.content = content;
    aiResponse.source = source;

    // 设置CORS头并返回响应
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(aiResponse);

  } catch (error) {
    console.error('Serverless Function错误:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

// 创建默认响应的备用函数
function createDefaultResponse(aiContent, source) {
  return {
    sift_analysis: {
      stop: "Based on AI analysis, this information contains multiple elements that require verification. It is recommended to stop sharing and conduct further verification.",
      investigate_source: `The credibility and background of "${source}" need further investigation.`,
      find_coverage: "It is recommended to search for relevant reports through authoritative news media and official channels for comparative verification.",
      trace_claims: "Need to track the original source of the information and check if it has been modified or distorted."
    },
    credibility_rating: "Needs Caution",
    final_advice: "Do not easily believe or share this information. It is recommended to verify through multiple reliable channels.",
    learning_tips: "When encountering suspicious information, first stop and think, then verify from multiple perspectives."
  };
}
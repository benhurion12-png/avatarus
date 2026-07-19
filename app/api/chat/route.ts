import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    const requestedProvider = process.env.LLM_PROVIDER?.toLowerCase();
    const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
    const hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY);
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

    const provider = requestedProvider === 'groq' || requestedProvider === 'openrouter' || requestedProvider === 'gemini' || requestedProvider === 'openai'
      ? requestedProvider
      : hasGroqKey
      ? 'groq'
      : hasOpenRouterKey
      ? 'openrouter'
      : hasGeminiKey
      ? 'gemini'
      : hasOpenAIKey
      ? 'openai'
      : undefined;

    const apiKey = provider === 'groq'
      ? process.env.GROQ_API_KEY
      : provider === 'openrouter'
      ? process.env.OPENROUTER_API_KEY
      : provider === 'gemini'
      ? process.env.GEMINI_API_KEY
      : provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : undefined;

    if (!provider) {
      return NextResponse.json({
        reply: 'Сервис LLM не настроен. Укажите LLM_PROVIDER=groq|openrouter|gemini|openai или добавьте хотя бы один ключ GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY.'
      }, { status: 500 });
    }

    if (!apiKey) {
      return NextResponse.json({
        reply: `LLM_PROVIDER=${provider} установлен, но ключ для ${provider} не найден. Добавьте ${provider === 'groq' ? 'GROQ_API_KEY' : provider === 'openrouter' ? 'OPENROUTER_API_KEY' : provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY'} в .env.local.`
      }, { status: 500 });
    }

    const shortAnswerInstruction = 'Отвечай коротко, в 2-3 предложениях.';
    const payload = provider === 'gemini'
      ? {
          contents: [{ parts: [{ text: `${shortAnswerInstruction} ${prompt}` }] }],
          temperature: 0.7,
          maxOutputTokens: 120
        }
      : {
          model: provider === 'groq' ? process.env.GROQ_MODEL || 'groq/compound-mini' : 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: shortAnswerInstruction },
            { role: 'user', content: prompt }
          ],
          max_tokens: 120,
          temperature: 0.7
        };

    const endpoint = provider === 'gemini'
      ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey
      : provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (provider !== 'gemini') {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
    } catch (fetchError: any) {
      console.error('Fetch failed for endpoint', endpoint, 'provider', provider, fetchError);
      return NextResponse.json({ reply: `Ошибка сервера: fetch failed for ${provider} endpoint ${endpoint} - ${fetchError?.message || fetchError}` }, { status: 500 });
    }

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ reply: `LLM API error: ${response.status} ${text}` }, { status: 500 });
    }

    const data = await response.json();
    const reply = provider === 'gemini'
      ? data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Пустой ответ.'
      : data?.choices?.[0]?.message?.content || data?.output?.[0]?.content?.[0]?.text || data?.text || 'Пустой ответ.';

    return NextResponse.json({ reply });
  } catch (error: any) {
    return NextResponse.json({ reply: `Ошибка сервера: ${error?.message || error}` }, { status: 500 });
  }
}

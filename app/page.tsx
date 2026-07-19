'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

const AvatarScene = dynamic(() => import('@/components/AvatarScene'), { ssr: false });

export default function Home() {
  const [prompt, setPrompt] = useState('Расскажи коротко, как я могу улучшить свою речь в публичных выступлениях.');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Готово.');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechPulse, setSpeechPulse] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [theme, setTheme] = useState<Theme>('light');

  const canRun = useMemo(() => typeof window !== 'undefined' && 'speechSynthesis' in window, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('theme');
    const initialTheme: Theme = savedTheme === 'light' || savedTheme === 'dark'
      ? savedTheme
      : window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';

    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('theme', nextTheme);
  };

  useEffect(() => {
    if (!canRun) {
      return;
    }

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [canRun]);

  const askAvatar = async () => {
    setIsLoading(true);
    setStatus('Запрашиваю ответ у LLM...');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      setResponse(data.reply || '');
      setStatus('Озвучиваю ответ...');
      if (canRun && typeof window !== 'undefined') {
        const utterance = new SpeechSynthesisUtterance(data.reply);
        const chosenVoice = voices[voiceIndex] ?? null;
        if (chosenVoice) {
          utterance.voice = chosenVoice;
          utterance.lang = chosenVoice.lang;
        } else {
          utterance.lang = 'ru-RU';
        }
        utterance.rate = 1.0;
        utterance.onstart = () => {
          setIsSpeaking(true);
          setSpeechPulse(0);
        };
        utterance.onend = () => setIsSpeaking(false);
        utterance.onboundary = () => setSpeechPulse((count) => count + 1);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
      setStatus('Готово.');
    } catch (error) {
      setStatus('Не удалось получить ответ. Проверь API ключи и сеть.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main>
      <div className="panel">
        <div className="theme-toolbar">
          <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Переключить цветовую тему">
            {theme === 'light' ? '🌙 Тёмная тема' : '☀️ Светлая тема'}
          </button>
        </div>
        <div className="hero">
          <section className="card">
            <h1 style={{ marginTop: 0 }}>AI Avatar speaking VRM</h1>
            <p style={{ color: '#b8c2d9', lineHeight: 1.6 }}>
              Этот проект загружает VRM-голову из папки проекта и позволяет ей отвечать на вопросы с помощью бесплатного LLM и браузерного TTS.
            </p>
            <textarea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Введите запрос для аватара..."
              style={{ marginBottom: 12 }}
            />
            <button onClick={askAvatar} disabled={isLoading} style={{ marginBottom: 12 }}>
              {isLoading ? 'Обработка...' : 'Спросить аватара'}
            </button>
            {voices.length > 0 && (
              <div style={{ marginBottom: 12, color: '#94a7c7' }}>
                <label style={{ display: 'block', marginBottom: 6 }}>
                  Выберите голос:
                </label>
                <select value={voiceIndex} onChange={(e) => setVoiceIndex(Number(e.target.value))}>
                  {voices.map((voice, index) => (
                    <option key={`${voice.name}-${index}`} value={index}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ fontSize: 14, color: '#94a7c7' }}>{status}</div>
            <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.05)' }}>
              <strong>Ответ:</strong>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{response || 'Пока нет ответа.'}</p>
            </div>
          </section>

          <section className="card">
            <AvatarScene isSpeaking={isSpeaking} speechPulse={speechPulse} />
          </section>
        </div>
      </div>
    </main>
  );
}

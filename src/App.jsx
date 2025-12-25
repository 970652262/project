import { useEffect, useState } from 'react';
import { useLazyQuery, gql } from '@apollo/client';
import './App.css';

// 定义 GraphQL 查询
const AI_QUERY = gql`
  query AskAI($prompt: String!) {
    ai(prompt: $prompt)
  }
`;


function App() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);

  // 使用 useLazyQuery 钩子
  const [askAI, { loading, data, error }] = useLazyQuery(AI_QUERY);

  // 处理AI 响应
  useEffect(() => {
    if (data?.ai) {
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: 'ai', content: data.ai },
      ]);
    }
  }, [data]);

  // 处理错误
  useEffect(() => {
    if (error) {
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: 'error', content: error.message },
      ]);
    }
  }, [error]);


  // 处理message提交
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    // 添加用户消息到消息列表
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: 'user', content: prompt },
    ]);

    // 触发 GraphQL 查询
    askAI({ variables: { prompt } });

    // 清空输入框
    setPrompt('');
  }

  return (
    <div className="app">
      <h1>AI Chat</h1>
      <p className="subtitle">Powered by Cloudflare Workers + GraphQL + DeepSeek</p>

      <div className="chat-container">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <span className="role">{msg.role === 'user' ? 'You' : 'AI'}:</span>
            <span className="content">{msg.content}</span>
          </div>
        ))}
        {loading && <div className="message ai loading">AI is thinking...</div>}
      </div>

      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask something..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !prompt.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}

export default App;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 寻找挂载点
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("无法找到 id 为 'root' 的 DOM 元素。请检查 index.html。");
} else {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
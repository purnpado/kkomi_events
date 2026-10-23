// 프로그램 화면 시작점
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import { connectBackend } from './core/eventBus';
import './modules'; // 모든 화면 모듈 등록
import App from './App';

// Go 이벤트 버스와 화면 이벤트 버스 연결
connectBackend();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

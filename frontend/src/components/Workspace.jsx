import React, { useState, useRef } from 'react';
import Flashcard from './Flashcard';
import { Send, Zap, Swords, UploadCloud, FileText, Settings, X } from 'lucide-react';

export default function Workspace({ onStartBattle }) {
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Chào bạn! Mình là AI Study Buddy. Bạn có thể tải bài giảng lên để học hoặc bắt đầu trò chơi Battle nhé!' }
  ]);
  const [inputVal, setInputVal] = useState('');
  
  // File management
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  // Flashcard setup
  const [selectedFile, setSelectedFile] = useState('');
  const [cardCount, setCardCount] = useState('10');

  const handleSend = () => {
    const text = inputVal.trim();
    if (!text) return;
    
    setInputVal('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    
    // Dummy response
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'bot', text: 'Đây là câu trả lời mẫu từ AI...' }]);
    }, 1000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleSend();
    }
  };

  const handleFileUpload = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(f => f.name);
      setFiles(prev => [...prev, ...newFiles]);
      if (!selectedFile) setSelectedFile(newFiles[0]); // Auto-select first uploaded file
    }
  };

  const handleGenerate = () => {
    if (files.length === 0) {
      alert("Vui lòng tải tệp lên trước khi tạo Flashcard!");
      return;
    }
    setShowFlashcards(true);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      {/* 
        Chatbot Area 
        Left Side: 70% mặc định, 40% khi showFlashcards
      */}
      <div 
        className={`flex flex-col border-r border-slate-200 transition-all duration-300 ${
          showFlashcards ? 'w-[40%]' : 'w-[70%]'
        }`}
      >
        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-lg text-indigo-600 flex items-center gap-2">
          <Zap className="w-5 h-5" /> Workspace
        </div>
        
        {/* Chat History */}
        <div className="flex-1 p-4 overflow-y-auto bg-slate-50/50 flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[80%] p-3 rounded-2xl whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-indigo-500 text-white rounded-tr-none' 
                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-full border border-slate-200">
            <input 
              type="text" 
              placeholder="Hỏi AI về bài giảng..." 
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent px-3 outline-none text-slate-700"
            />
            <button 
              onClick={handleSend}
              className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-full transition-colors focus:outline-none"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 
        Right Content Area (Controls + Flashcards)
        Right Side: 30% mặc định, 60% khi showFlashcards
      */}
      <div 
        className={`flex flex-col bg-slate-50 transition-all duration-300 ${
          showFlashcards ? 'w-[60%]' : 'w-[30%]'
        }`}
      >
        {showFlashcards ? (
          <div className="flex flex-col flex-1">
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
              <h3 className="font-bold text-slate-700">Bộ Flashcard ({cardCount === 'full' ? 'Tất cả' : cardCount} thẻ)</h3>
              <button 
                onClick={() => setShowFlashcards(false)}
                className="text-slate-400 hover:text-red-500 transition-colors focus:outline-none"
                title="Đóng Flashcards"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto flex items-center justify-center">
              <Flashcard />
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 p-6 gap-8 overflow-y-auto">
            {/* Header Controls */}
            <button 
              onClick={onStartBattle}
              className="w-full py-4 px-4 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-md transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 focus:outline-none text-lg"
            >
              <Swords className="w-6 h-6" /> Start Battle
            </button>

            {/* File Management Section */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> Tài liệu học tập
              </h3>
              
              <input 
                type="file" 
                multiple 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-600 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 focus:outline-none mb-4"
              >
                <UploadCloud className="w-5 h-5" /> Tải tài liệu lên (PDF, TXT)
              </button>

              {files.length > 0 ? (
                <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{f}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 text-center italic">Chưa có tài liệu nào.</p>
              )}
            </div>

            {/* Flashcard Setup Section */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" /> Cấu hình Flashcard
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nguồn tài liệu:</label>
                  <select 
                    value={selectedFile}
                    onChange={(e) => setSelectedFile(e.target.value)}
                    disabled={files.length === 0}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {files.length === 0 && <option value="">--- Trống ---</option>}
                    {files.map((f, i) => (
                      <option key={i} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số lượng thẻ:</label>
                  <select 
                    value={cardCount}
                    onChange={(e) => setCardCount(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="10">10 thẻ</option>
                    <option value="20">20 thẻ</option>
                    <option value="full">Full (Toàn bộ)</option>
                  </select>
                </div>

                <button 
                  onClick={handleGenerate}
                  className="w-full py-3 mt-2 bg-indigo-100 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold rounded-lg transition-colors focus:outline-none"
                >
                  Tạo Flashcards
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

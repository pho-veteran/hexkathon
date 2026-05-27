import React, { useState } from 'react';

const DUMMY_CARDS = [
  { front: 'Gradient Descent là gì?', back: 'Là thuật toán tối ưu hóa lặp để tìm giá trị cực tiểu của một hàm số bằng cách di chuyển ngược hướng với gradient của hàm số đó.' },
  { front: 'Machine Learning là gì?', back: 'Là một lĩnh vực của AI cho phép hệ thống học từ dữ liệu mà không cần được lập trình cụ thể.' },
  { front: 'AWS S3 là gì?', back: 'Amazon Simple Storage Service (S3) là dịch vụ lưu trữ đối tượng cung cấp khả năng mở rộng, tính khả dụng của dữ liệu, bảo mật và hiệu năng hàng đầu trong ngành.' }
];

export default function Flashcard() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleNext = (e) => {
    e.stopPropagation();
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % DUMMY_CARDS.length);
    }, 150);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + DUMMY_CARDS.length) % DUMMY_CARDS.length);
    }, 150);
  };

  const currentCard = DUMMY_CARDS[currentIndex];

  return (
    <div className="w-full max-w-2xl px-4 flex flex-col items-center gap-6">
      {/* Cấu trúc Flip Card */}
      <div 
        className="w-full h-80 md:h-96 perspective-1000 cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div 
          className={`relative w-full h-full duration-500 preserve-3d shadow-xl rounded-2xl ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* Mặt trước */}
          <div className="absolute w-full h-full backface-hidden bg-white border border-slate-200 rounded-2xl p-8 flex items-center justify-center text-center">
            <h3 className="text-3xl font-bold text-slate-800 leading-snug">{currentCard.front}</h3>
          </div>
          
          {/* Mặt sau */}
          <div className="absolute w-full h-full backface-hidden bg-indigo-50 border border-indigo-100 rounded-2xl p-8 flex items-center justify-center text-center rotate-y-180">
            <p className="text-xl text-indigo-900 leading-relaxed font-medium">
              {currentCard.back}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center w-full px-2 text-slate-500 font-medium">
        <button 
          onClick={handlePrev}
          className="px-4 py-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors focus:outline-none"
        >
          &larr; Thẻ trước
        </button>
        <span className="bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
          {currentIndex + 1} / {DUMMY_CARDS.length}
        </span>
        <button 
          onClick={handleNext}
          className="px-4 py-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors focus:outline-none"
        >
          Thẻ tiếp theo &rarr;
        </button>
      </div>
    </div>
  );
}

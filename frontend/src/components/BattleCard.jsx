import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, Skull, User, Swords, Zap } from 'lucide-react';

import openingGif from '../assets/opening.gif';
import winAvif from '../assets/win.avif';
import loseJpg from '../assets/lose.jpg';
import streakGif from '../assets/streak.gif';
import boss1Gif from '../assets/boss 1.gif';

const QUESTIONS = [
  { text: 'AWS EC2 là viết tắt của từ gì?', options: ['Elastic Compute Cloud', 'Elastic Container Cloud', 'Elastic Core Cloud', 'Elastic Cloud Compute'], answer: 0 },
  { text: 'Dịch vụ nào của AWS tối ưu cho NoSQL?', options: ['RDS', 'DynamoDB', 'Redshift', 'Aurora'], answer: 1 },
  { text: 'Để lưu trữ object số lượng lớn, dùng service nào?', options: ['EBS', 'EFS', 'S3', 'Glacier'], answer: 2 },
  { text: 'Serverless compute nổi tiếng nhất của AWS?', options: ['EC2', 'Fargate', 'Lambda', 'Beanstalk'], answer: 2 },
  { text: 'Dịch vụ AI tạo sinh của AWS là gì?', options: ['SageMaker', 'Bedrock', 'Rekognition', 'Lex'], answer: 1 },
  { text: 'VPC dùng để làm gì?', options: ['Virtual Private Cloud', 'Virtual Public Cloud', 'VPN Cloud', 'Video Processing'], answer: 0 },
  { text: 'CDN của AWS tên là?', options: ['Global Accelerator', 'CloudFront', 'Route53', 'API Gateway'], answer: 1 },
  { text: 'Công cụ giám sát resource AWS?', options: ['CloudTrail', 'Config', 'CloudWatch', 'Inspector'], answer: 2 },
  { text: 'Bảo mật mạng mức subnet dùng?', options: ['Security Group', 'Network ACL', 'WAF', 'Shield'], answer: 1 },
  { text: 'Kho vector cho RAG trên AWS Bedrock phụ thuộc?', options: ['OpenSearch', 'Kendra', 'Elasticsearch', 'Athena'], answer: 0 },
];

const BOSS_NAMES = ['The Cloud Architect', 'Database Overlord', 'Sage of Systems', 'Network Ninja', 'IAM Enforcer', 'Cost Optimizer'];

export default function BattleCard({ onEndBattle }) {
  const [isOpening, setIsOpening] = useState(true);
  const [difficulty, setDifficulty] = useState(null); // 'easy' | 'medium' | 'hard'
  const [currentIdx, setCurrentIdx] = useState(0);
  const [bossHp, setBossHp] = useState(100);
  const [playerHp, setPlayerHp] = useState(100);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [progress, setProgress] = useState(Array(10).fill('null'));
  
  const [timeLeft, setTimeLeft] = useState(15);
  const [maxTime, setMaxTime] = useState(15);
  
  const [isGameOver, setIsGameOver] = useState(false);
  const [bossName, setBossName] = useState('');
  const [bossImage, setBossImage] = useState('');
  const [gifLoadTime, setGifLoadTime] = useState(null);
  
  // States for visual effects
  const [flashEffect, setFlashEffect] = useState(null); // 'correct' | 'wrong' | null
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [attackEffect, setAttackEffect] = useState(null); // 'slash' | 'hit' | null
  const [damagePopup, setDamagePopup] = useState(null); // { text, type } | null
  const attackKeyRef = useRef(0);

  useEffect(() => {
    setBossName(BOSS_NAMES[Math.floor(Math.random() * BOSS_NAMES.length)]);
    setBossImage(boss1Gif);
  }, []);

  // Wait for GIF to fully play through before hiding opening screen
  useEffect(() => {
    if (!isOpening || gifLoadTime === null) return;
    const elapsed = Date.now() - gifLoadTime;
    // GIF duration approx: use a generous fallback of 6s from load time
    // We track when the GIF was loaded and wait for the full playthrough
    const GIF_DURATION_MS = 6000; // adjust if your opening.gif is longer/shorter
    const remaining = Math.max(0, GIF_DURATION_MS - elapsed);
    const timer = setTimeout(() => {
      setIsOpening(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [gifLoadTime]);

  // Timer logic
  useEffect(() => {
    if (isOpening || !difficulty || isGameOver || isTransitioning) return;
    if (timeLeft <= 0) {
      handleAnswer(-1); // Timeout = wrong
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, difficulty, isGameOver, isTransitioning]);

  const handleDifficulty = (level) => {
    setDifficulty(level);
    const time = level === 'easy' ? 20 : level === 'medium' ? 15 : 10;
    setTimeLeft(time);
    setMaxTime(time);
  };

  const handleAnswer = (selectedIndex) => {
    if (isGameOver || isTransitioning) return;
    setIsTransitioning(true);

    const currentQ = QUESTIONS[currentIdx];
    const isCorrect = selectedIndex === currentQ.answer;

    setFlashEffect(isCorrect ? 'correct' : 'wrong');

    // ⚔️ Trigger attack animation
    attackKeyRef.current += 1;
    if (isCorrect) {
      setAttackEffect('slash');
      setDamagePopup({ text: '-10 HP', type: 'damage' });
    } else {
      setAttackEffect('hit');
      setDamagePopup({ text: '-20 HP', type: 'self' });
    }
    setTimeout(() => {
      setAttackEffect(null);
      setDamagePopup(null);
    }, 900);

    let newProgress = [...progress];
    if (isCorrect) {
      newProgress[currentIdx] = 'correct';
      setScore((s) => s + 10);
      setBossHp((prev) => Math.max(0, prev - 10));
      setStreak((prev) => prev + 1);
    } else {
      newProgress[currentIdx] = 'wrong';
      setPlayerHp((prev) => Math.max(0, prev - 20));
      setStreak(0);
    }
    setProgress(newProgress);

    setTimeout(() => {
      setFlashEffect(null);
      setIsTransitioning(false);
      if (bossHp - (isCorrect ? 10 : 0) <= 0 || playerHp - (isCorrect ? 0 : 20) <= 0 || currentIdx === 9) {
        setIsGameOver(true);
      } else {
        setCurrentIdx((i) => i + 1);
        const time = difficulty === 'easy' ? 20 : difficulty === 'medium' ? 15 : 10;
        setTimeLeft(time);
        setMaxTime(time);
      }
    }, 500);
  };

  if (isOpening) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <h2 className="text-4xl font-black uppercase tracking-widest text-red-500 animate-pulse mb-8 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">
          Entering Battle...
        </h2>
        <img
          src={openingGif}
          alt="Opening Sequence"
          onLoad={() => setGifLoadTime(Date.now())}
          className="w-full max-w-4xl rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.3)] object-cover mix-blend-screen"
          style={{ maxHeight: '70vh' }}
        />
      </div>
    );
  }

  if (!difficulty) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 tracking-wider font-mono uppercase">
          Select Difficulty
        </h1>
        <div className="flex gap-4">
          {['easy', 'medium', 'hard'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => handleDifficulty(lvl)}
              className="px-8 py-3 rounded-lg border-2 border-slate-700 bg-slate-800 hover:bg-slate-700 hover:border-indigo-500 text-lg font-bold uppercase transition focus:outline-none"
            >
              {lvl}
            </button>
          ))}
        </div>
        <button onClick={onEndBattle} className="mt-12 text-slate-400 hover:text-white flex items-center gap-2 focus:outline-none">
          <ArrowLeft className="w-4 h-4" /> Back to Workspace
        </button>
      </div>
    );
  }

  // Dynamic Background classes
  let bgClass = 'bg-[#0f172a]';
  if (isGameOver) {
    bgClass = playerHp > 0 ? 'bg-green-900' : 'bg-red-900';
  } else if (flashEffect === 'correct') {
    bgClass = 'bg-green-900/40';
  } else if (flashEffect === 'wrong') {
    bgClass = 'bg-red-900/40';
  }

  return (
    <div className={`min-h-screen ${bgClass} text-white flex flex-col p-6 font-mono tracking-tight transition-colors duration-300 relative overflow-hidden`}>
      {/* ── CSS Keyframes for battle animations ── */}
      <style>{`
        @keyframes slashFly {
          0%   { transform: translate(0, 0) scale(1) rotate(-20deg); opacity: 1; }
          60%  { transform: translate(-260px, -180px) scale(1.6) rotate(15deg); opacity: 1; }
          100% { transform: translate(-320px, -230px) scale(0.4) rotate(30deg); opacity: 0; }
        }
        @keyframes damageFloat {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-80px) scale(1.4); opacity: 0; }
        }
        @keyframes selfDmgFloat {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-60px) scale(1.2); opacity: 0; }
        }
        @keyframes playerShake {
          0%, 100% { transform: translateX(0); }
          20%  { transform: translateX(-8px) rotate(-3deg); }
          40%  { transform: translateX(8px) rotate(3deg); }
          60%  { transform: translateX(-6px) rotate(-2deg); }
          80%  { transform: translateX(6px) rotate(2deg); }
        }
        @keyframes bossShake {
          0%, 100% { transform: translateX(0); }
          25%  { transform: translateX(6px); }
          75%  { transform: translateX(-6px); }
        }
        @keyframes criticalFlash {
          0%   { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          40%  { opacity: 1; transform: scale(1.2) rotate(5deg); }
          100% { opacity: 0; transform: scale(1.5) rotate(0deg); }
        }
        .anim-slash     { animation: slashFly 0.85s ease-in forwards; }
        .anim-damage    { animation: damageFloat 0.9s ease-out forwards; }
        .anim-selfdmg   { animation: selfDmgFloat 0.9s ease-out forwards; }
        .anim-pshake    { animation: playerShake 0.5s ease-in-out; }
        .anim-bshake    { animation: bossShake 0.4s ease-in-out; }
        .anim-critical  { animation: criticalFlash 0.85s ease-out forwards; }
      `}</style>
      {/* Header controls */}
      <button onClick={onEndBattle} className="self-start text-slate-400 hover:text-white mb-4 flex items-center gap-2 focus:outline-none relative z-10">
        <ArrowLeft className="w-4 h-4" /> Flee Battle
      </button>

      {isGameOver ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
          <img 
            src={playerHp > 0 ? winAvif : loseJpg} 
            alt={playerHp > 0 ? 'Victory' : 'Defeat'} 
            className="w-full max-w-3xl object-cover mb-8 rounded-2xl shadow-2xl border-4 border-slate-800" 
            style={{ maxHeight: '60vh' }}
            onError={(e) => e.target.style.display='none'}
          />
          <h2 className={`text-6xl font-black mb-4 uppercase drop-shadow-lg ${playerHp > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {playerHp > 0 ? 'VICTORY' : 'DEFEAT'}
          </h2>
          <p className="text-2xl text-slate-200 mb-8 font-semibold">Final Score: <span className="text-white font-bold">{score}</span></p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-8 py-4 bg-white text-slate-900 hover:bg-slate-200 rounded font-bold uppercase shadow-xl transition-transform hover:scale-105 focus:outline-none"
          >
            Play Again
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center max-w-5xl w-full mx-auto relative z-10 justify-center gap-4">

          {/* 1. Boss Area */}
          <div className="w-full flex flex-col gap-2">
            <div
              className={`w-full rounded-xl border-2 border-red-500 overflow-hidden relative shadow-[0_0_15px_rgba(239,68,68,0.5)] flex items-center justify-center ${attackEffect === 'slash' ? 'anim-bshake' : ''}`}
              style={{ backgroundColor: '#0f172a', minHeight: '180px', maxHeight: '340px' }}
            >
              <img
                src={bossImage}
                alt="Boss"
                className="w-auto h-auto max-w-full object-contain z-10"
                style={{ maxHeight: '340px' }}
                onError={(e) => e.target.style.display='none'}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent z-20 pointer-events-none"></div>
              {/* Boss hit red flash */}
              {attackEffect === 'slash' && (
                <div className="absolute inset-0 z-25 pointer-events-none rounded-xl" style={{ background: 'rgba(239,68,68,0.35)', animation: 'criticalFlash 0.6s ease-out forwards' }} />
              )}
              {/* Damage number floating on boss */}
              {damagePopup?.type === 'damage' && (
                <div
                  key={attackKeyRef.current}
                  className="absolute top-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none font-black text-3xl text-red-400 drop-shadow-[0_0_10px_rgba(255,80,80,0.9)] anim-damage"
                >
                  {damagePopup.text}
                </div>
              )}
              {/* CRITICAL HIT label */}
              {attackEffect === 'slash' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none anim-critical">
                  <span className="text-2xl font-black uppercase tracking-widest text-yellow-300 drop-shadow-[0_0_15px_rgba(255,200,0,1)]">⚔ CRITICAL HIT!</span>
                </div>
              )}
              <div className="absolute bottom-3 left-4 z-30 flex items-center gap-2">
                <Skull className="w-6 h-6 text-red-500" />
                <span className="text-xl font-bold uppercase text-red-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{bossName}</span>
              </div>
            </div>
            {/* Boss HP Bar */}
            <div className="w-full flex flex-col">
              <div className="flex justify-between items-end mb-1 px-1">
                <span className="text-sm font-semibold uppercase text-red-400">Boss HP</span>
                <span className="text-xs font-bold text-slate-400">{bossHp}/100</span>
              </div>
              <div className={`w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 ${flashEffect === 'correct' ? 'animate-pulse ring-2 ring-red-500' : ''}`}>
                <div 
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${bossHp}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 2. Quiz Area */}
          <div className="w-full flex flex-col items-center">
            <div className="w-full flex justify-between items-end mb-2 px-1">
              <span className="text-slate-400 text-sm font-semibold">Question {currentIdx + 1}/10</span>
              <span className="text-indigo-400 text-sm font-semibold tracking-wider uppercase">Score: {score}</span>
            </div>
            
            <div className={`w-full bg-slate-800 border transition-colors duration-300 ${flashEffect === 'correct' ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : flashEffect === 'wrong' ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'border-slate-700'} p-6 rounded-xl shadow-lg mb-4`}>
              <h3 className="text-xl font-semibold leading-relaxed text-center">
                {QUESTIONS[currentIdx].text}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
              {QUESTIONS[currentIdx].options.map((opt, i) => (
                <button
                  key={i}
                  disabled={isTransitioning}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleAnswer(i);
                  }}
                  className={`border text-left p-4 rounded-lg transition-all text-base focus:outline-none 
                    ${isTransitioning 
                      ? (QUESTIONS[currentIdx].answer === i 
                          ? 'bg-green-600/30 border-green-500 opacity-100'
                          : 'bg-slate-800/50 border-slate-700 opacity-50') 
                      : 'bg-slate-800/50 border-slate-700 hover:bg-indigo-600/20 hover:border-indigo-500 active:scale-95'}`}
                >
                  <span className="text-slate-500 mr-3 font-bold">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Player Area – HP bar + avatar */}
          <div className="w-full flex items-center gap-4 relative">
            {/* Self-damage popup above player area */}
            {damagePopup?.type === 'self' && (
              <div
                key={attackKeyRef.current}
                className="absolute right-0 z-50 pointer-events-none font-black text-2xl text-red-400 drop-shadow-[0_0_8px_rgba(255,80,80,0.9)] anim-selfdmg"
                style={{ bottom: '100%' }}
              >
                {damagePopup.text}
              </div>
            )}

            <div className="flex-1 flex flex-col text-right">
              <div className="flex justify-between items-end mb-1 flex-row-reverse">
                <span className="text-lg font-bold uppercase text-green-400">Player 1</span>
                <span className="text-xs text-slate-400">{playerHp}/100 HP</span>
              </div>
              <div className={`w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 ${flashEffect === 'wrong' ? 'animate-pulse ring-2 ring-red-500' : ''}`}>
                <div 
                  className="h-full bg-green-500 transition-all duration-300 ml-auto"
                  style={{ width: `${playerHp}%` }}
                ></div>
              </div>
            </div>

            {/* Player Avatar – streak GIF overlays/replaces avatar */}
            <div
              className={`w-20 h-20 shrink-0 rounded-full border-4 flex items-center justify-center overflow-hidden relative
                ${attackEffect === 'hit' ? 'anim-pshake border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.7)]' : streak >= 4 ? 'border-yellow-400 shadow-[0_0_20px_rgba(255,200,0,0.6)]' : 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]'}
                bg-slate-800`}
            >
              {/* Default icon (hidden when streak active) */}
              {streak < 4 && <User className="w-10 h-10 text-green-500" />}

              {/* Streak GIF overlays avatar completely */}
              {streak >= 4 && (
                <img
                  src={streakGif}
                  alt="Streak"
                  className="absolute inset-0 w-full h-full object-cover mix-blend-screen"
                  onError={(e) => e.target.style.display='none'}
                />
              )}

              {/* Red hit overlay when taking damage */}
              {attackEffect === 'hit' && (
                <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: 'rgba(239,68,68,0.5)', animation: 'criticalFlash 0.5s ease-out forwards' }} />
              )}
            </div>
          </div>

          {/* 4. Progress Tracker + Timer (inline, not absolute) */}
          <div className="w-full flex flex-col items-center pt-2 border-t border-slate-800">
            <div className="flex gap-2 mb-3">
              {progress.map((val, idx) => (
                <div 
                  key={idx} 
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    val === 'correct' ? 'bg-green-500/20 border-green-500 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' :
                    val === 'wrong' ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                    currentIdx === idx ? 'border-indigo-400 bg-indigo-500/20 scale-110 shadow-[0_0_10px_rgba(129,140,248,0.5)]' :
                    'border-slate-700 bg-slate-800 text-transparent'
                  }`}
                >
                  {val === 'correct' ? <CheckCircle2 className="w-5 h-5" /> :
                   val === 'wrong' ? <XCircle className="w-5 h-5" /> : null}
                </div>
              ))}
            </div>
            {/* Timer bar */}
            <div className="w-full">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1">
                <span>TIME REMAINING</span>
                <span className={`text-sm ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-indigo-400'}`}>{timeLeft}s</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full border border-slate-700 overflow-hidden flex justify-end">
                <div 
                  className={`h-full transition-all duration-1000 ease-linear ${timeLeft <= 5 ? 'bg-red-500' : 'bg-indigo-500'}`}
                  style={{ width: `${(timeLeft / maxTime) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

        </div>
      )}



    </div>
  );
}

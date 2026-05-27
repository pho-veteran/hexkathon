import React, { useState } from 'react';
import Workspace from './components/Workspace';
import BattleCard from './components/BattleCard';
import './index.css'; // Assuming Tailwind is configured here

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('workspace'); // 'workspace' | 'battle'

  const handleStartBattle = () => {
    setCurrentScreen('battle');
  };

  const handleEndBattle = () => {
    setCurrentScreen('workspace');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {currentScreen === 'workspace' ? (
        <Workspace onStartBattle={handleStartBattle} />
      ) : (
        <BattleCard onEndBattle={handleEndBattle} />
      )}
    </div>
  );
}

import React, { useState, useCallback } from 'react';
import { SolarSystem } from './components/SolarSystem';
import { HandController } from './components/HandController';

const App: React.FC = () => {
  // state: 'normal' | 'merged'
  const [systemState, setSystemState] = useState<'normal' | 'merged'>('normal');
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const handleGestureChange = useCallback((isFist: boolean) => {
    setSystemState(isFist ? 'merged' : 'normal');
  }, []);

  return (
    <div className="relative w-screen h-screen bg-[#010003] overflow-hidden">
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <SolarSystem systemState={systemState} />
      </div>

      {/* UI Layer */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 p-6 flex flex-col justify-between">
        
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-white text-3xl font-light tracking-[0.2em] uppercase text-shadow-glow">
              Chenjunwei's Solar<span className="font-bold text-purple-400">Gesture</span>
            </h1>
            <p className="text-purple-200 text-xs tracking-widest mt-2 uppercase opacity-70">
              Interactive WebGL System
            </p>
          </div>
          
          {/* Webcam / Controller */}
          <div className="pointer-events-auto relative">
             <div className={`transition-all duration-300 border border-purple-500/30 rounded-lg overflow-hidden bg-black/50 backdrop-blur-md ${cameraEnabled ? 'w-48 h-36' : 'w-48 h-10'}`}>
                {cameraEnabled && (
                  <HandController onGestureChange={handleGestureChange} />
                )}
                <button 
                  onClick={() => setCameraEnabled(!cameraEnabled)}
                  className="absolute bottom-2 right-2 text-[10px] bg-purple-900/80 text-white px-2 py-1 rounded uppercase tracking-widest hover:bg-purple-700 transition-colors"
                >
                  {cameraEnabled ? 'Hide Cam' : 'Show Cam'}
                </button>
             </div>
             <div className="mt-2 text-right">
                <p className="text-[10px] text-white/50 uppercase tracking-widest">
                  Status: <span className={systemState === 'merged' ? 'text-red-400 font-bold' : 'text-blue-400 font-bold'}>
                    {systemState === 'merged' ? 'MERGED (Fist)' : 'ORBITING (Open)'}
                  </span>
                </p>
             </div>
          </div>
        </div>

        {/* Footer Instructions */}
        <div className="text-center pb-4">
           <div className="inline-block bg-black/40 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full">
              <p className="text-purple-200 text-xs tracking-[0.15em] uppercase">
                <span className="font-bold text-white">Instruction:</span> Show hand to camera. 
                <span className="mx-2">✊ Clench to Merge</span> 
                <span className="mx-2">✋ Release to Orbit</span>
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;

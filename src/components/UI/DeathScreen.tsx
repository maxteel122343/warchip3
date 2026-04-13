/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { RefreshCcw, AlertTriangle } from 'lucide-react';

interface DeathScreenProps {
  onRespawn: () => void;
}

const DeathScreen: React.FC<DeathScreenProps> = ({ onRespawn }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/90 backdrop-blur-xl z-[100]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/5 border border-white/10 p-6 md:p-12 rounded-[32px] md:rounded-[40px] w-full max-w-lg text-center shadow-2xl mx-4"
      >
        <div className="flex justify-center mb-4 md:mb-6">
          <div className="bg-red-500/20 p-4 md:p-6 rounded-full">
            <AlertTriangle className="text-red-500 w-10 h-10 md:w-16 md:h-16" />
          </div>
        </div>
        
        <h2 className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tighter uppercase italic">You Sunk!</h2>
        <p className="text-white/50 mb-8 md:mb-12 font-medium text-sm md:text-base">Your ship was destroyed in battle.</p>

        {/* Mock AdMob Ad */}
        <div className="bg-white/10 border border-white/10 rounded-2xl p-4 mb-8 md:mb-12 relative overflow-hidden group">
          <div className="absolute top-2 left-2 bg-yellow-400 text-black text-[8px] font-black px-1 rounded uppercase">Ad</div>
          <div className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl md:text-2xl">W</div>
            <div>
              <h3 className="text-white font-bold text-xs md:text-sm">Warship Tycoon</h3>
              <p className="text-white/50 text-[8px] md:text-[10px]">Build your own naval empire!</p>
              <div className="flex gap-1 mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 md:w-2 md:h-2 bg-yellow-400 rounded-full" />
                ))}
              </div>
            </div>
          </div>
          <button className="w-full mt-4 bg-white text-black font-black py-2 rounded-lg text-[10px] md:text-xs uppercase tracking-widest group-hover:bg-yellow-400 transition-colors">
            Install Now
          </button>
        </div>

        <button
          onClick={onRespawn}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 md:py-6 rounded-2xl text-xl md:text-2xl uppercase tracking-widest transition-all transform active:scale-95 flex items-center justify-center gap-3 md:gap-4"
        >
          <RefreshCcw size={24} className="md:w-8 md:h-8" />
          Respawn Now
        </button>
      </motion.div>
    </div>
  );
};

export default DeathScreen;

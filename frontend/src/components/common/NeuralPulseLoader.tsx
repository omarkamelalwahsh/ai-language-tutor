import React from 'react';
import { motion } from 'motion/react';
import { BrainCircuit } from 'lucide-react';

interface NeuralPulseLoaderProps {
  status?: string;
  fullscreen?: boolean;
}

export const NeuralPulseLoader: React.FC<NeuralPulseLoaderProps> = ({ 
  status = "Synthesizing Linguistic Model...", 
  fullscreen = true 
}) => {
  return (
    <div className={`${fullscreen ? 'fixed inset-0 min-h-screen' : 'w-full py-20'} bg-slate-50 dark:bg-gray-950 flex flex-col items-center justify-center z-[9999] overflow-hidden transition-colors duration-300`}>
      {/* Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600 dark:bg-blue-600/10 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PScwIDAgMjAwIDIwMCcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz48ZmlsdGVyIGlkPSdub2lzZUZpbHRlcic+PGZlVHVyYnVsZW5jZSB0eXBlPSdmcmFjdGFsTm9pc2UnIGJhc2VGcmVxdWVuY3k9JzAuNjUnIG51bU9jdGF2ZXM9JzMnIHN0aXRjaFRpbGVzPSdzdGl0Y2gnLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0nMTAwJScgaGVpZ2h0PScxMDAlJyBmaWx0ZXI9J3VybCgjbm9pc2VGaWx0ZXIpJy8+PC9zdmc+')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative flex flex-col items-center gap-12">
        {/* Core Neural Pulse Animation */}
        <div className="relative">
          {/* Animated Rings */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: [0.8, 1.5, 2],
                opacity: [0, 0.3, 0]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 1,
                ease: "easeOut"
              }}
              className={`absolute inset-0 rounded-full border stroke-[0.5px] ${
                i % 2 === 0 ? 'border-blue-400/30' : 'border-teal-400/30'
              } dark:border-blue-500/30`}
            />
          ))}

          {/* Central Logo Node */}
          <motion.div
            animate={{ 
              boxShadow: [
                "0 2px 10px 0 rgba(148, 163, 184, 0.1)",
                "0 4px 20px 0 rgba(148, 163, 184, 0.15)",
                "0 2px 10px 0 rgba(148, 163, 184, 0.1)"
              ],
              scale: [1, 1.02, 1]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-24 h-24 bg-white dark:bg-blue-600 rounded-[2rem] flex items-center justify-center relative z-10 border border-slate-200 dark:border-blue-400/30"
          >
            <BrainCircuit className="w-12 h-12 text-blue-600 dark:text-white" />
          </motion.div>
        </div>

        {/* Status Text with Scanning Effect */}
        <div className="text-center space-y-3 relative z-10">
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tighter uppercase italic flex items-center gap-2">
            AI <span className="text-blue-600 dark:text-blue-400">Tutor</span> Protocol
          </h2>
          <div className="flex flex-col items-center gap-1">
             <p className="text-[10px] font-black tracking-[0.5em] text-slate-500 uppercase">
                {status}
             </p>
             <div className="w-32 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mt-2">
               <motion.div 
                 animate={{ x: [-128, 128] }}
                 transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                 className="w-full h-full bg-blue-600"
               />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

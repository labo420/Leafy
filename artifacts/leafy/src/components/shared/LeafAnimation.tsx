import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf } from 'lucide-react';

interface FallingLeaf {
  id: number;
  x: number;
  delay: number;
  duration: number;
  rotation: number;
  scale: number;
  color: string;
}

const colors = ['text-primary', 'text-secondary', 'text-accent', 'text-green-500'];

export function LeafAnimation({ isActive, onComplete }: { isActive: boolean, onComplete?: () => void }) {
  const [leaves, setLeaves] = useState<FallingLeaf[]>([]);

  useEffect(() => {
    if (isActive) {
      const newLeaves = Array.from({ length: 25 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        rotation: Math.random() * 360,
        scale: 0.5 + Math.random() * 1,
        color: colors[Math.floor(Math.random() * colors.length)]
      }));
      setLeaves(newLeaves);
      
      const timer = setTimeout(() => {
        setLeaves([]);
        onComplete?.();
      }, 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isActive, onComplete]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {leaves.map((leaf) => (
          <motion.div
            key={leaf.id}
            initial={{ y: -50, x: `${leaf.x}vw`, rotate: 0, opacity: 0 }}
            animate={{ 
              y: '100vh', 
              x: `${leaf.x + (Math.random() * 20 - 10)}vw`,
              rotate: leaf.rotation + 360, 
              opacity: [0, 1, 1, 0] 
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: leaf.duration, 
              delay: leaf.delay, 
              ease: "linear" 
            }}
            className={`absolute ${leaf.color}`}
            style={{ scale: leaf.scale }}
          >
            <Leaf fill="currentColor" strokeWidth={1} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

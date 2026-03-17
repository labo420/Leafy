import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LevelProgressProps {
  progress: number; // 0 to 100
  level: string;
  points: number;
  className?: string;
  size?: number;
  strokeWidth?: number;
}

export function LevelProgress({ 
  progress, 
  level, 
  points, 
  className,
  size = 200,
  strokeWidth = 16
}: LevelProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      {/* Background Circle */}
      <svg className="absolute transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-muted"
        />
        {/* Progress Circle */}
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeLinecap="round"
          className="text-secondary drop-shadow-[0_0_8px_rgba(82,183,136,0.5)]"
        />
      </svg>
      
      {/* Inner Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">{level}</span>
        <span className="font-display text-4xl font-bold text-primary tracking-tighter">
          {new Intl.NumberFormat("it-IT").format(points)}
        </span>
        <span className="text-xs font-medium text-muted-foreground mt-1">XP</span>
      </div>
    </div>
  );
}

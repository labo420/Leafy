import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "accent" | "green" | "blue" | "teal" | "red";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground shadow",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    accent: "border-transparent bg-accent text-accent-foreground",
    outline: "text-foreground border-border",
    green: "border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    blue: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    teal: "border-transparent bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100",
    red: "border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };

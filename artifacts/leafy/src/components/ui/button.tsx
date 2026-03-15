import * as React from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "accent" | "ghost-muted" | "destructive";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground shadow-md shadow-secondary/20 hover:bg-secondary/90",
  accent: "bg-accent text-accent-foreground shadow-md shadow-accent/20 hover:bg-accent/90",
  outline: "border-2 border-primary/20 text-primary hover:bg-primary/5",
  ghost: "text-primary hover:bg-primary/10",
  "ghost-muted": "text-muted-foreground hover:bg-muted hover:text-foreground",
  destructive: "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90",
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "h-12 px-6 py-3",
  sm: "h-9 px-4 text-sm",
  lg: "h-14 px-8 text-lg",
  icon: "h-12 w-12",
};

const BASE_CLASSES = "inline-flex items-center justify-center whitespace-nowrap rounded-2xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

export function buttonVariants({ variant = "default", size = "default", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(BASE_CLASSES, variantStyles[variant], sizeStyles[size], className);
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, ...props }, ref) => {
    return (
      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98, y: 0 }}
        ref={ref}
        disabled={isLoading || props.disabled}
        className={buttonVariants({ variant, size, className })}
        {...(props as any)}
      >
        {isLoading ? (
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";

export { Button };

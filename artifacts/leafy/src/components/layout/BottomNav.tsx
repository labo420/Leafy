import { Link, useLocation } from "wouter";
import { Home, Camera, ScrollText, Gift, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/scan", icon: Camera, label: "Scan" },
  { href: "/storico", icon: ScrollText, label: "Storico" },
  { href: "/marketplace", icon: Gift, label: "Premi" },
  { href: "/profilo", icon: User, label: "Profilo" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 bg-card border-t border-border/50 pb-safe rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
      <nav className="flex justify-around items-center px-2 py-3 h-20">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href} className="relative flex-1 flex flex-col items-center justify-center gap-1 group">
              {isActive && (
                <motion.div 
                  layoutId="bottom-nav-indicator"
                  className="absolute -top-3 w-12 h-1 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <motion.div 
                whileTap={{ scale: 0.9 }}
                className={cn(
                  "p-2 rounded-2xl transition-colors duration-300",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground group-hover:bg-muted"
                )}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <span className={cn(
                "text-[10px] font-medium transition-colors duration-300",
                isActive ? "text-primary font-bold" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

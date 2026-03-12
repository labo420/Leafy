import React from "react";
import { useGetReceipts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Receipt, CalendarDays, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";

export default function History() {
  const { data: receipts, isLoading } = useGetReceipts();

  // Mock data if backend is empty
  const list = receipts && receipts.length > 0 ? receipts : [
    { id: 1, storeName: "NaturaSì", purchaseDate: "2025-01-15T10:30:00Z", pointsEarned: 150, greenItemsCount: 3, categories: ["Bio", "Km 0"], scannedAt: "2025-01-15T14:20:00Z" },
    { id: 2, storeName: "Supermercato Locale", purchaseDate: "2025-01-12T09:15:00Z", pointsEarned: 45, greenItemsCount: 1, categories: ["Senza Plastica"], scannedAt: "2025-01-12T10:00:00Z" },
    { id: 3, storeName: "Mercato Contadino", purchaseDate: "2025-01-08T08:00:00Z", pointsEarned: 220, greenItemsCount: 5, categories: ["Km 0", "Bio", "Vegano"], scannedAt: "2025-01-08T11:45:00Z" },
  ];

  const getCategoryColor = (cat: string) => {
    const map: Record<string, "green" | "blue" | "teal" | "red" | "accent" | "default"> = {
      "Bio": "green",
      "Km 0": "blue",
      "Senza Plastica": "teal",
      "Equo Solidale": "red",
      "Vegano": "accent",
    };
    return map[cat] || "default";
  };

  return (
    <div className="p-6 pt-10 min-h-full">
      <header className="mb-8">
        <h1 className="font-display font-bold text-3xl text-foreground mb-2">Storico</h1>
        <p className="text-muted-foreground">I tuoi acquisti sostenibili nel tempo.</p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="w-full h-32 bg-card rounded-3xl border border-border/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="hover:border-primary/30 transition-colors cursor-pointer group">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary/20 text-secondary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground leading-tight">{item.storeName || "Negozio Sconosciuto"}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <CalendarDays className="w-3 h-3" />
                          {format(parseISO(item.purchaseDate || item.scannedAt), "dd MMM yyyy", { locale: it })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-primary/10 text-primary font-bold px-3 py-1 rounded-full text-sm">
                        +{item.pointsEarned} pts
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 items-center pt-3 border-t border-border/50">
                    <span className="text-xs font-medium text-muted-foreground mr-1">
                      {item.greenItemsCount} prodotti:
                    </span>
                    {item.categories.map((cat, idx) => (
                      <Badge key={idx} variant={getCategoryColor(cat)} className="text-[10px]">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          
          {list.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-muted mx-auto mb-4" />
              <h3 className="font-bold text-lg text-foreground">Nessuno scontrino</h3>
              <p className="text-muted-foreground mt-1">Inizia a scansionare per guadagnare punti!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

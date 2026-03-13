import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const STORAGE_KEY = "leafy_onboarded";

const steps = [
  {
    emoji: "🌿",
    title: "Benvenuto su Leafy!",
    description: "La piattaforma che premia le tue scelte green. Ogni prodotto sostenibile che compri vale punti reali.",
    highlight: null,
  },
  {
    emoji: "📸",
    title: "Scansiona lo scontrino",
    description: "Fotografa il tuo scontrino dopo la spesa. Leafy riconosce i prodotti Bio, Km 0, Vegani, Plastic-free e molto altro.",
    highlight: "Bio · Km 0 · Vegano · Senza Plastica · Fairtrade · DOP/IGP",
  },
  {
    emoji: "⬆️",
    title: "Sali di livello",
    description: "Accumula punti per sbloccare i livelli Bronzo, Argento, Oro e Platino. Più alto è il livello, migliori i premi!",
    highlight: "🥉 Bronzo → 🥈 Argento → 🥇 Oro → 💎 Platino",
  },
  {
    emoji: "🎁",
    title: "Riscatta i premi",
    description: "Usa i punti nel Marketplace per ottenere voucher esclusivi dai tuoi brand preferiti. Zero sprechi, solo benefici.",
    highlight: null,
  },
];

export function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const next = () => {
    if (step < steps.length - 1) setStep(s => s + 1);
    else finish();
  };

  const current = steps[step];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-24 pt-4"
          onClick={(e) => { if (e.target === e.currentTarget) finish(); }}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-background w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="bg-gradient-to-br from-primary/15 to-secondary/10 p-8 text-center">
              <motion.div
                key={step}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="text-7xl mb-5"
              >
                {current.emoji}
              </motion.div>
              <motion.h2
                key={`title-${step}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="font-display font-bold text-2xl text-foreground mb-3"
              >
                {current.title}
              </motion.h2>
              <motion.p
                key={`desc-${step}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.05 }}
                className="text-muted-foreground leading-relaxed"
              >
                {current.description}
              </motion.p>
              {current.highlight && (
                <motion.div
                  key={`hl-${step}`}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="mt-4 bg-primary/10 rounded-2xl px-4 py-3"
                >
                  <p className="text-sm font-semibold text-primary">{current.highlight}</p>
                </motion.div>
              )}
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-center gap-2">
                {steps.map((_, i) => (
                  <button key={i} onClick={() => setStep(i)}
                    className={`rounded-full transition-all duration-300 ${i === step ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30"}`}
                  />
                ))}
              </div>

              {step < steps.length - 1 ? (
                <div className="flex gap-3">
                  <Button variant="ghost" className="flex-1 rounded-xl" onClick={finish}>
                    Salta
                  </Button>
                  <Button className="flex-1 rounded-xl" onClick={next}>
                    Avanti
                  </Button>
                </div>
              ) : (
                <Link href="/scan" onClick={finish}>
                  <Button className="w-full rounded-xl h-12 text-base font-semibold shadow-lg shadow-primary/20" onClick={finish}>
                    Scansiona il primo scontrino!
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

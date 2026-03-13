import { Link } from "wouter";
import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
      <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
        <Leaf className="w-12 h-12" />
      </div>
      <h1 className="text-4xl font-display font-bold text-foreground mb-2">Ops! 404</h1>
      <p className="text-muted-foreground mb-8">
        Sembra che questa foglia sia volata via. La pagina che cerchi non esiste.
      </p>
      <Link href="/" className="block w-full">
        <Button className="w-full">
          Torna alla Home
        </Button>
      </Link>
    </div>
  );
}

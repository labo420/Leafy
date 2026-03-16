import { useState, useEffect } from "react";
import { AlertCircle, Check, X, Lock } from "lucide-react";

interface FlaggedReceipt {
  id: number;
  userId: number;
  storeName: string | null;
  purchaseDate: string | null;
  pointsEarned: number;
  status: string;
  flagReason: string | null;
  scannedAt: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [flagged, setFlagged] = useState<FlaggedReceipt[]>([]);
  const [pending, setPending] = useState<FlaggedReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8080/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setIsAuthenticated(true);
        loadFlaggedReceipts();
      } else {
        setError("Password non valida");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFlaggedReceipts = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8080/api/admin/fraud/flagged", {
        headers: { "x-admin-password": password },
      });
      if (res.ok) {
        const data = await res.json();
        setFlagged(data.flagged || []);
        setPending(data.pending || []);
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateReceipt = async (id: number, status: string) => {
    try {
      const res = await fetch(`http://localhost:8080/api/admin/fraud/receipts/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setFlagged(flagged.filter((r) => r.id !== id));
        setPending(pending.filter((r) => r.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const approvePending = async () => {
    try {
      const res = await fetch("http://localhost:8080/api/admin/fraud/approve-pending", {
        method: "POST",
        headers: { "x-admin-password": password },
      });
      if (res.ok) {
        const data = await res.json();
        alert(`${data.approved} punti approvati automaticamente`);
        loadFlaggedReceipts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-sm">
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center shadow-sm">
              <img src="/leafy-icon-dark.png" alt="Leafy" className="w-10 h-10 object-contain" />
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">Admin Anti-Frode</h1>
            </div>
          </div>
          <form onSubmit={authenticate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Inserisci password admin"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50"
            >
              {loading ? "Accesso..." : "Accedi"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pannello Anti-Frode</h1>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
          >
            Esci
          </button>
        </div>

        {/* Scansioni segnalate */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-bold text-gray-900">{flagged.length} Scansioni Segnalate</h2>
          </div>
          {flagged.length === 0 ? (
            <div className="p-6 bg-white rounded-lg border border-gray-200 text-gray-500 text-center">
              Nessuna scansione segnalata
            </div>
          ) : (
            <div className="space-y-3">
              {flagged.map((receipt) => (
                <div key={receipt.id} className="p-4 bg-white border border-red-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {receipt.storeName || "Negozio sconosciuto"}
                      </p>
                      <p className="text-sm text-gray-600">{receipt.pointsEarned} punti</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                      {receipt.flagReason || "Alto valore"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{new Date(receipt.scannedAt).toLocaleString()}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateReceipt(receipt.id, "approved")}
                      className="flex-1 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded flex items-center justify-center gap-2 text-sm"
                    >
                      <Check className="w-4 h-4" /> Approva
                    </button>
                    <button
                      onClick={() => updateReceipt(receipt.id, "rejected")}
                      className="flex-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded flex items-center justify-center gap-2 text-sm"
                    >
                      <X className="w-4 h-4" /> Rifiuta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Punti in attesa (account nuovi) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">{pending.length} Punti In Attesa</h2>
            {pending.length > 0 && (
              <button
                onClick={approvePending}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm disabled:opacity-50"
              >
                Approva Tutti
              </button>
            )}
          </div>
          {pending.length === 0 ? (
            <div className="p-6 bg-white rounded-lg border border-gray-200 text-gray-500 text-center">
              Nessun punto in attesa
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((receipt) => (
                <div key={receipt.id} className="p-4 bg-white border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">User #{receipt.userId}</p>
                      <p className="text-sm text-gray-600">{receipt.pointsEarned} punti</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      In attesa 48h
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(receipt.scannedAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

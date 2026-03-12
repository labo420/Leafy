export function LogoPreview() {
  return (
    <div className="min-h-screen bg-[#F8F9F4] flex flex-col items-center justify-center gap-16 p-12">
      <div className="flex flex-col items-center gap-6 w-full max-w-xl">
        <p className="text-xs font-semibold text-[#7A9E8A] uppercase tracking-widest">Wordmark — uso generico</p>
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 w-full flex items-center justify-center">
          <img src="/__mockup/images/logo-wordmark.png" alt="Leafy Wordmark" className="h-20 object-contain" />
        </div>
        <div className="bg-[#2D6A4F] rounded-3xl shadow-sm p-10 w-full flex items-center justify-center">
          <img src="/__mockup/images/logo-wordmark.png" alt="Leafy Wordmark dark" className="h-20 object-contain brightness-0 invert" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 w-full max-w-xl">
        <p className="text-xs font-semibold text-[#7A9E8A] uppercase tracking-widest">Icona App — favicon, badge, avatar</p>
        <div className="flex gap-6 items-end justify-center flex-wrap">
          <div className="flex flex-col items-center gap-2">
            <img src="/__mockup/images/logo-icon.png" alt="App Icon 120" className="w-[120px] h-[120px] rounded-[27px] shadow-lg object-contain" />
            <span className="text-[10px] text-gray-400">120px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <img src="/__mockup/images/logo-icon.png" alt="App Icon 80" className="w-20 h-20 rounded-[18px] shadow-md object-contain" />
            <span className="text-[10px] text-gray-400">80px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <img src="/__mockup/images/logo-icon.png" alt="App Icon 48" className="w-12 h-12 rounded-xl shadow object-contain" />
            <span className="text-[10px] text-gray-400">48px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <img src="/__mockup/images/logo-icon.png" alt="App Icon 32" className="w-8 h-8 rounded-lg shadow object-contain" />
            <span className="text-[10px] text-gray-400">32px</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 w-full max-w-xl">
        <p className="text-xs font-semibold text-[#7A9E8A] uppercase tracking-widest">Palette Brand</p>
        <div className="flex gap-3 justify-center">
          {[
            { color: "#2D6A4F", label: "Forest" },
            { color: "#52B788", label: "Mint" },
            { color: "#F4A261", label: "Amber" },
            { color: "#F8F9F4", label: "Cream", border: true },
          ].map(({ color, label, border }) => (
            <div key={color} className="flex flex-col items-center gap-1">
              <div
                className="w-10 h-10 rounded-full shadow-sm"
                style={{ background: color, border: border ? "1px solid #ddd" : "none" }}
              />
              <span className="text-[9px] text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

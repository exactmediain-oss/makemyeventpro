import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, ArrowRight } from "lucide-react";

export default function HeroCarousel({ banners, area }) {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const n = banners.length;

  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n]);

  if (!n) return null;
  const b = banners[i];

  return (
    <div className="relative h-[240px] sm:h-[340px] lg:h-[420px] rounded-3xl overflow-hidden shadow-2xl" data-testid="hero-carousel">
      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }} className="absolute inset-0">
          <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 flex items-center">
        <div className="px-6 sm:px-12 max-w-xl">
          <motion.div key={`c-${i}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-white text-xs font-semibold mb-3">
              <MapPin className="h-3 w-3 text-pink-300" /> Near {area}, Hyderabad
            </div>
            <h2 className="font-display font-extrabold text-2xl sm:text-4xl lg:text-5xl text-white leading-tight tracking-tight">
              {b.title}
            </h2>
            <p className="text-white/85 mt-2 text-sm sm:text-base">{b.subtitle}</p>
            <button data-testid="hero-cta-btn" onClick={() => b.category_slug ? navigate(`/category/${b.category_slug}`) : navigate("/search")}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-slate-900 font-semibold text-sm hover:gap-3 transition-all">
              {b.cta} <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        </div>
      </div>

      {n > 1 && (
        <>
          <button onClick={() => setI((p) => (p - 1 + n) % n)} data-testid="hero-prev"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/20 backdrop-blur hidden sm:flex items-center justify-center text-white hover:bg-white/30">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => setI((p) => (p + 1) % n)} data-testid="hero-next"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/20 backdrop-blur hidden sm:flex items-center justify-center text-white hover:bg-white/30">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-6 sm:left-12 flex gap-1.5">
            {banners.map((_, idx) => (
              <button key={idx} onClick={() => setI(idx)}
                className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-white" : "w-1.5 bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

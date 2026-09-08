import { BRAND_LOGO } from "@/lib/constants";
import { Instagram, Facebook, Youtube, Linkedin } from "lucide-react";

const cols = [
  { title: "Customers", links: ["Browse Vendors", "Event Planner", "My Favorites", "How it Works", "Reviews"] },
  { title: "Vendors", links: ["List Your Business", "Vendor Login", "Pricing & Plans", "Success Stories", "Vendor Help"] },
  { title: "Company", links: ["About Us", "Careers", "Contact", "Blog", "Press"] },
  { title: "Legal", links: ["Terms", "Privacy Policy", "Refund Policy", "Cancellation", "Vendor Terms"] },
];

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-300 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              <img src={BRAND_LOGO} alt="MakeMyEventPro" className="h-11 w-11 rounded-xl" />
              <span className="font-display font-extrabold text-lg text-white">MakeMyEventPro</span>
            </div>
            <p className="text-sm text-slate-400 mt-4 max-w-xs">
              India's premium event marketplace. Discover, compare & book verified vendors for every celebration. Now live in Hyderabad.
            </p>
            <div className="flex gap-3 mt-5">
              {[Instagram, Facebook, Youtube, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-500 transition-colors">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="font-display font-bold text-white text-sm mb-4">{c.title}</h4>
              <ul className="space-y-2.5">
                {c.links.map((l) => <li key={l}><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>© 2026 MakeMyEventPro · makemyeventpro.com · Made with care in Hyderabad</span>
          <span>Prices in ₹ INR · Asia/Kolkata</span>
        </div>
      </div>
    </footer>
  );
}

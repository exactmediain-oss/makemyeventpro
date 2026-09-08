import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import Layout from "@/components/Layout";
import VendorCard from "@/components/VendorCard";
import EnquiryDialog from "@/components/EnquiryDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function Favorites() {
  const navigate = useNavigate();
  const { user, setAuthOpen, favorites } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enquire, setEnquire] = useState(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.get("/favorites").then((r) => setVendors(r.data.vendors)).finally(() => setLoading(false));
  }, [user, favorites.length]);

  if (!user) return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <Heart className="h-14 w-14 mx-auto text-pink-400 mb-4" />
        <h2 className="font-display font-bold text-2xl">Your favorites are waiting for you</h2>
        <p className="text-muted-foreground mt-2">Login to save and revisit your favourite vendors.</p>
        <Button data-testid="favorites-login-btn" onClick={() => setAuthOpen(true)} className="mt-5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">Login</Button>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl mb-6 flex items-center gap-2">
          <Heart className="h-7 w-7 fill-pink-500 text-pink-500" /> My Favorites
        </h1>
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-80 rounded-3xl" />)}</div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-20" data-testid="empty-favorites">
            <div className="text-5xl mb-4">💜</div>
            <h3 className="font-display font-bold text-xl">No favorites yet</h3>
            <p className="text-muted-foreground mt-1">Tap the heart on any vendor to save it here.</p>
            <Button onClick={() => navigate("/")} className="mt-5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">Explore Vendors</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {vendors.map((v, i) => <VendorCard key={v.id} vendor={v} index={i} onEnquire={setEnquire} />)}
          </div>
        )}
      </div>
      <EnquiryDialog open={!!enquire} onOpenChange={(o) => !o && setEnquire(null)} vendor={enquire} />
    </Layout>
  );
}

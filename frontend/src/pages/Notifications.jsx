import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function Notifications() {
  const { user, setAuthOpen } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => { if (user) api.get("/notifications").then((r) => setItems(r.data)); }, [user]);

  if (!user) return (
    <Layout><div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <Bell className="h-12 w-12 mx-auto text-purple-500 mb-4" />
      <h2 className="font-display font-bold text-2xl">Login to see notifications</h2>
      <Button onClick={() => setAuthOpen(true)} className="mt-5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500">Login</Button>
    </div></Layout>
  );

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display font-extrabold text-2xl mb-6 flex items-center gap-2"><Bell className="h-6 w-6 text-purple-600" /> Notifications</h1>
        {items.length === 0 ? (
          <div className="text-center py-20"><div className="text-5xl mb-4">🔔</div><p className="text-muted-foreground">No notifications yet.</p></div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => (
              <div key={n.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="font-semibold">{n.title}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

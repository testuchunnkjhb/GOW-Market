import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Header from "@/components/Header";
import { Eye } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Favorites = () => {
  const { t } = useLanguage();
  const { token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/favorites`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFavorites(response.data);
    } catch (error) {
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!token) {
      navigate("/");
      return;
    }
    fetchFavorites();
  }, [token, authLoading, navigate, fetchFavorites]);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="favorites-page">
        <h1 className="text-3xl font-black text-zinc-950 dark:text-white mb-8">
          {t("favorites")}
        </h1>

        {loading ? (
          <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
            {t("loading")}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
            {t("no_results")}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {favorites.map((ad) => (
              <div
                key={ad.id}
                className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden hover:-translate-y-1 hover:shadow-lg transition cursor-pointer"
                onClick={() => navigate(`/ad/${ad.id}`)}
                data-testid={`favorite-ad-${ad.id}`}
              >
                <div className="relative h-48 bg-zinc-100 dark:bg-zinc-800">
                  {ad.images && ad.images.length > 0 ? (
                    <img
                      src={`${API}/files/${ad.images[0]}`}
                      alt={ad.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = "https://images.pexels.com/photos/19439173/pexels-photo-19439173.jpeg";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-zinc-950 dark:text-white mb-2 line-clamp-2">
                    {ad.title}
                  </h3>
                  {ad.price && (
                    <div className="text-xl font-black text-red-600 mb-2">
                      {new Intl.NumberFormat('uz-UZ').format(ad.price)} UZS
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                    <Eye className="w-4 h-4" />
                    <span>{ad.views} {t("views")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;

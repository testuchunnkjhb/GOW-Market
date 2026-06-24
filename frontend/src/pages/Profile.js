import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Plus } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Profile = () => {
  const { t } = useLanguage();
  const { token, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [ads, setAds] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const fetchMyAds = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/users/me/ads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAds(response.data);
    } catch (error) {
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  const fetchFavorites = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/favorites`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFavorites(response.data);
    } catch (error) {
      console.error("Failed to fetch favorites:", error);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!token) {
      navigate("/");
      return;
    }
    fetchMyAds();
    fetchFavorites();
  }, [token, authLoading, navigate, fetchMyAds, fetchFavorites]);

  const filterAds = useCallback((status) => {
    if (status === "all") return ads;
    return ads.filter(ad => ad.status === status);
  }, [ads]);

  const getStatusBadge = (status) => {
    const colors = {
      active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
    };
    return colors[status] || "";
  };

  const renderAdCard = useCallback((ad) => (
    <div
      key={ad.id}
      className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden hover:-translate-y-1 hover:shadow-lg transition"
      data-testid={`profile-ad-${ad.id}`}
    >
      <div
        className="relative h-48 bg-zinc-100 dark:bg-zinc-800 cursor-pointer"
        onClick={() => navigate(`/ad/${ad.id}`)}
      >
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
        {ad.status && (
          <span className={`absolute top-2 left-2 px-2 py-1 text-xs font-bold rounded ${getStatusBadge(ad.status)}`}>
            {ad.status.toUpperCase()}
          </span>
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
  ), [navigate, t]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="profile-page">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-zinc-950 dark:text-white mb-2">
              {user.name}
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">{user.phone}</p>
          </div>
          <Button
            onClick={() => navigate("/create")}
            className="bg-red-600 hover:bg-red-700 text-white font-bold"
            data-testid="create-ad-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("create_ad")}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start mb-8 bg-zinc-100 dark:bg-zinc-900">
            <TabsTrigger value="all" data-testid="tab-all">{t("my_listings")}</TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">{t("active")}</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">{t("pending")}</TabsTrigger>
            <TabsTrigger value="favorites" data-testid="tab-favorites">{t("favorites")}</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {loading ? (
              <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
                {t("loading")}
              </div>
            ) : filterAds("all").length === 0 ? (
              <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
                {t("no_results")}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filterAds("all").map(renderAdCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active">
            {filterAds("active").length === 0 ? (
              <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
                {t("no_results")}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filterAds("active").map(renderAdCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending">
            {filterAds("pending").length === 0 ? (
              <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
                {t("no_results")}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filterAds("pending").map(renderAdCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="favorites">
            {favorites.length === 0 ? (
              <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
                {t("no_results")}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {favorites.map(renderAdCard)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;

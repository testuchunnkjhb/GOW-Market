import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Heart, Eye } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Home = () => {
  const { t, language } = useLanguage();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    fetchCategories();
    fetchAds();
  }, [searchParams]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/categories`);
      setCategories(response.data);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  const fetchAds = async () => {
    setLoading(true);
    try {
      const search = searchParams.get("search");
      const category = searchParams.get("category");
      const params = new URLSearchParams();
      
      if (search) params.append("search", search);
      if (category) params.append("category_id", category);
      
      const response = await axios.get(`${API}/ads?${params}`);
      setAds(response.data);
    } catch (error) {
      console.error("Failed to fetch ads:", error);
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (adId) => {
    if (!token) {
      toast.error(t("error"), { description: "Please login first" });
      return;
    }

    try {
      await axios.post(
        `${API}/favorites/toggle`,
        { ad_id: adId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t("success"));
    } catch (error) {
      toast.error(t("error"));
    }
  };

  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId);
    navigate(`/?category=${categoryId}`);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      {/* Hero Section */}
      <div
        className="relative h-[400px] flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1553544438-f38bf768a907?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NDh8MHwxfHNlYXJjaHwyfHxzYW1hcmthbmQlMjBhcmNoaXRlY3R1cmV8ZW58MHx8fHwxNzgyMjg4NzYzfDA&ixlib=rb-4.1.0&q=85")',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
        data-testid="hero-section"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/70 to-zinc-950/40"></div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-4 tracking-tight drop-shadow-lg">
            GOW Market
          </h1>
          <p className="text-2xl sm:text-3xl text-white font-bold mb-4 drop-shadow">
            Oson soting. Xavfsiz xarid qiling.
          </p>
          <p className="text-lg sm:text-xl text-zinc-100 mb-8 drop-shadow">
            Telefonlar, avtomobillar, uy-joy va minglab e'lonlar bir joyda. 🚀
          </p>
          <Button
            onClick={() => navigate("/create")}
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-lg px-8 py-6 shadow-xl"
            data-testid="create-ad-hero-btn"
          >
            E'lon berish
          </Button>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="categories-section">
        <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white mb-6 tracking-tight">
          {t("categories")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className={`p-6 border rounded-lg transition hover:-translate-y-1 hover:shadow-lg ${
                selectedCategory === category.id
                  ? "border-red-600 bg-red-50 dark:bg-red-950/20"
                  : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
              }`}
              data-testid={`category-${category.id}`}
            >
              <div className="text-center">
                <div className="text-2xl mb-2">📦</div>
                <div className="text-sm font-bold text-zinc-950 dark:text-white">
                  {language === "uz" ? category.name_uz : category.name_ru}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Ads Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="ads-section">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white tracking-tight">
            {t("recent_ads")}
          </h2>
          {selectedCategory && (
            <Button
              variant="outline"
              onClick={() => {
                setSelectedCategory(null);
                navigate("/");
              }}
              data-testid="clear-category-btn"
            >
              {t("all_categories")}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-zinc-600 dark:text-zinc-400">{t("loading")}</div>
          </div>
        ) : ads.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-zinc-600 dark:text-zinc-400">{t("no_results")}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {ads.map((ad) => (
              <div
                key={ad.id}
                className="ad-card border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 hover:-translate-y-1 hover:shadow-lg transition"
                data-testid={`ad-card-${ad.id}`}
              >
                <div
                  className="relative h-48 bg-zinc-100 dark:bg-zinc-800 overflow-hidden cursor-pointer"
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(ad.id);
                    }}
                    className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-zinc-900/90 rounded-full hover:bg-white dark:hover:bg-zinc-900 transition"
                    data-testid={`favorite-btn-${ad.id}`}
                  >
                    <Heart className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                  </button>
                </div>
                <div className="p-4">
                  <h3
                    className="font-bold text-zinc-950 dark:text-white mb-2 line-clamp-2 cursor-pointer hover:text-red-600 transition"
                    onClick={() => navigate(`/ad/${ad.id}`)}
                    data-testid={`ad-title-${ad.id}`}
                  >
                    {ad.title}
                  </h3>
                  {ad.price && (
                    <div className="text-xl font-black text-red-600 mb-2">
                      {new Intl.NumberFormat('uz-UZ').format(ad.price)} UZS
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{ad.views}</span>
                    </div>
                    <div className="text-xs">
                      {ad.location?.address || "Samarqand"}
                    </div>
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

export default Home;

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Heart, Eye, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Safe array normalization
const toArray = (data) => {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  if (typeof data === "object") {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.rows)) return data.rows;
    if (Array.isArray(data.ads)) return data.ads;
    if (Array.isArray(data.categories)) return data.categories;
    return [];
  }
  return [];
};

// Safe text sanitization
const sanitizeText = (text) => {
  if (!text) return "";
  return String(text).replace(/[<>]/g, "");
};

// Safe price formatting
const formatPrice = (price) => {
  if (price === null || price === undefined) return null;
  const num = Number(price);
  if (isNaN(num) || num < 0) return null;
  try {
    return new Intl.NumberFormat("uz-UZ").format(num);
  } catch {
    return String(num);
  }
};

// Safe number
const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

// Skeleton loading component
const SkeletonCard = () => (
  <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden animate-pulse">
    <div className="h-48 bg-zinc-200 dark:bg-zinc-700"></div>
    <div className="p-4 space-y-3">
      <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4"></div>
      <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2"></div>
      <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/4"></div>
    </div>
  </div>
);

// Skeleton category
const SkeletonCategory = () => (
  <div className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg animate-pulse">
    <div className="text-center">
      <div className="text-2xl mb-2">📦</div>
      <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-20 mx-auto"></div>
    </div>
  </div>
);

const Home = () => {
  const { t, language } = useLanguage();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);

  // Sync selectedCategory with URL params
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    } else {
      setSelectedCategory(null);
    }
  }, [searchParams]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/categories`, {
        timeout: 8000,
      });
      const categoriesArray = toArray(response.data);
      if (isMounted.current) {
        setCategories(categoriesArray);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      if (isMounted.current) {
        setCategories([]);
        toast.error(t("error"), {
          description: t("failed_to_load_categories") || "Failed to load categories",
        });
      }
    }
  }, [t]);

  const fetchAds = useCallback(async () => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    setLoading(true);
    setError(null);

    try {
      const search = searchParams.get("search");
      const category = searchParams.get("category");
      const params = new URLSearchParams();

      if (search) params.append("search", sanitizeText(search));
      if (category) params.append("category_id", category);

      const response = await axios.get(`${API}/ads?${params}`, {
        timeout: 10000,
      });

      const adsArray = toArray(response.data);
      if (isMounted.current) {
        setAds(adsArray);
        setError(null);
        setRetryCount(0);
      }
    } catch (error) {
      console.error("Failed to fetch ads:", error);

      let errorMessage = t("failed_to_load_ads") || "Failed to load ads";

      if (error.response) {
        if (error.response.status === 500) {
          errorMessage = t("server_error") || "Server error. Please try again later.";
        } else if (error.response.status === 404) {
          errorMessage = t("no_ads_found") || "No ads found";
        }
      } else if (error.code === "ECONNABORTED") {
        errorMessage = t("request_timeout") || "Request timed out. Please try again.";
      }

      if (isMounted.current) {
        setError(errorMessage);
        setAds([]);
        if (retryCount < 2) {
          toast.error(t("error"), { description: errorMessage });
        }
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        fetchInProgress.current = false;
      }
    }
  }, [searchParams, t, retryCount]);

  // Initial data fetch and re-fetch when search params change
  useEffect(() => {
    isMounted.current = true;

    const loadData = async () => {
      try {
        await Promise.all([fetchCategories(), fetchAds()]);
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    };

    loadData();

    return () => {
      isMounted.current = false;
      fetchInProgress.current = false;
    };
  }, [fetchCategories, fetchAds]);

  const toggleFavorite = useCallback(
    async (adId) => {
      if (!token) {
        toast.error(t("error"), {
          description: t("please_login_first") || "Please login first",
        });
        return;
      }

      try {
        await axios.post(
          `${API}/favorites/toggle`,
          { ad_id: adId },
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 8000,
          }
        );
        toast.success(t("success"));
      } catch (error) {
        console.error("Failed to toggle favorite:", error);
        toast.error(t("error"), {
          description: t("failed_to_update_favorite") || "Failed to update favorite",
        });
      }
    },
    [token, t]
  );

  const handleCategoryClick = useCallback(
    (categoryId) => {
      setSelectedCategory(categoryId);
      navigate(`/?category=${categoryId}`);
    },
    [navigate]
  );

  const handleClearCategory = useCallback(() => {
    setSelectedCategory(null);
    navigate("/");
  }, [navigate]);

  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
    fetchAds();
  }, [fetchAds]);

  const handleNavigateToAd = useCallback(
    (adId) => {
      if (adId) {
        navigate(`/ad/${String(adId)}`);
      }
    },
    [navigate]
  );

  // Render categories
  const renderCategories = () => {
    if (loading && categories.length === 0) {
      return (
        <>
          {[...Array(5)].map((_, index) => (
            <SkeletonCategory key={index} />
          ))}
        </>
      );
    }

    if (!Array.isArray(categories) || categories.length === 0) {
      return (
        <div className="col-span-full text-center py-8 text-zinc-600 dark:text-zinc-400">
          {t("no_categories") || "No categories available"}
        </div>
      );
    }

    return categories.map((category) => (
      <button
        key={category.id || Math.random().toString()}
        onClick={() => handleCategoryClick(category.id)}
        className={`p-6 border rounded-lg transition hover:-translate-y-1 hover:shadow-lg ${
          selectedCategory === category.id
            ? "border-red-600 bg-red-50 dark:bg-red-950/20"
            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
        }`}
        data-testid={`category-${category.id}`}
      >
        <div className="text-center">
          <div className="text-2xl mb-2">
            {category.icon || "📦"}
          </div>
          <div className="text-sm font-bold text-zinc-950 dark:text-white">
            {language === "uz"
              ? sanitizeText(category.name_uz) || "Unnamed"
              : sanitizeText(category.name_ru) || "Unnamed"}
          </div>
        </div>
      </button>
    ));
  };

  // Render ads
  const renderAds = () => {
    if (loading && ads.length === 0) {
      return (
        <>
          {[...Array(8)].map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </>
      );
    }

    if (error) {
      return (
        <div className="col-span-full text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <div className="text-zinc-600 dark:text-zinc-400 mb-4">{error}</div>
          <Button
            onClick={handleRetry}
            className="bg-red-600 hover:bg-red-700 text-white"
            data-testid="retry-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("retry") || "Retry"}
          </Button>
        </div>
      );
    }

    if (!Array.isArray(ads) || ads.length === 0) {
      return (
        <div className="col-span-full text-center py-12">
          <div className="text-zinc-600 dark:text-zinc-400">
            {t("no_results") || "No ads found"}
          </div>
        </div>
      );
    }

    return ads.map((ad) => {
      const adId = ad.id ? String(ad.id) : null;
      const title = sanitizeText(ad.title) || "Untitled";
      const price = formatPrice(ad.price);
      const views = safeNumber(ad.views);
      const images = toArray(ad.images);
      const location = ad.location?.address || "Samarqand";
      const isActive = ad.status === "active";

      return (
        <div
          key={adId || Math.random().toString()}
          className="ad-card border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 hover:-translate-y-1 hover:shadow-lg transition group"
          data-testid={`ad-card-${adId}`}
        >
          <div
            className="relative h-48 bg-zinc-100 dark:bg-zinc-800 overflow-hidden cursor-pointer"
            onClick={() => handleNavigateToAd(adId)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleNavigateToAd(adId);
              }
            }}
          >
            {images.length > 0 && images[0] ? (
              <img
                src={`${API}/files/${String(images[0])}`}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                onError={(e) => {
                  e.target.src =
                    "https://images.pexels.com/photos/19439173/pexels-photo-19439173.jpeg";
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400 bg-zinc-100 dark:bg-zinc-800">
                {t("no_image") || "No image"}
              </div>
            )}

            {!isActive && (
              <div className="absolute top-3 left-3 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                {t("inactive") || "Inactive"}
              </div>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(adId);
              }}
              className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-zinc-900/90 rounded-full hover:bg-white dark:hover:bg-zinc-900 transition"
              data-testid={`favorite-btn-${adId}`}
              aria-label="Toggle favorite"
            >
              <Heart className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            </button>
          </div>

          <div className="p-4">
            <h3
              className="font-bold text-zinc-950 dark:text-white mb-2 line-clamp-2 cursor-pointer hover:text-red-600 transition"
              onClick={() => handleNavigateToAd(adId)}
              data-testid={`ad-title-${adId}`}
            >
              {title}
            </h3>

            {price !== null && (
              <div className="text-xl font-black text-red-600 mb-2">
                {price} UZS
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                <span>
                  {views} {t("views") || "views"}
                </span>
              </div>
              <div className="text-xs truncate max-w-[100px]">{location}</div>
            </div>

            {ad.created_at && (
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                {new Date(ad.created_at).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      {/* Hero Section */}
      <div
        className="relative h-[400px] flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage:
            'url("https://images.unsplash.com/photo-1553544438-f38bf768a907?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NDh8MHwxfHNlYXJjaHwyfHxzYW1hcmthbmQlMjBhcmNoaXRlY3R1cmV8ZW58MHx8fHwxNzgyMjg4NzYzfDA&ixlib=rb-4.1.0&q=85")',
          backgroundSize: "cover",
          backgroundPosition: "center",
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
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
        data-testid="categories-section"
      >
        <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white mb-6 tracking-tight">
          {t("categories") || "Categories"}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {renderCategories()}
        </div>
      </div>

      {/* Ads Grid */}
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
        data-testid="ads-section"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white tracking-tight">
            {t("recent_ads") || "Recent Ads"}
          </h2>
          {selectedCategory && (
            <Button
              variant="outline"
              onClick={handleClearCategory}
              data-testid="clear-category-btn"
            >
              {t("all_categories") || "All Categories"}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {renderAds()}
        </div>
      </div>
    </div>
  );
};

export default Home;

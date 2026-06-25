import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Eye, Heart, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Safe array extraction with fallback
const toArray = (data) => {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  if (typeof data === "object") {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.favorites)) return data.favorites;
    if (Array.isArray(data.ads)) return data.ads;
    return [];
  }
  return [];
};

// Safe string sanitization
const sanitizeText = (text) => {
  if (!text) return "";
  const str = String(text);
  // Remove potentially dangerous characters
  return str.replace(/[<>]/g, "");
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

// Safe number formatter
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

const Favorites = () => {
  const { t } = useLanguage();
  const { token, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);

  const fetchFavorites = useCallback(async (isRetry = false) => {
    // Prevent multiple simultaneous fetches
    if (fetchInProgress.current) {
      return;
    }

    if (!token) {
      setLoading(false);
      return;
    }

    fetchInProgress.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API}/favorites`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
        withCredentials: true,
      });

      // Safely extract array from response
      const favoritesArray = toArray(response.data);
      
      // Validate each favorite item
      const validatedFavorites = favoritesArray.filter((item) => {
        return item && typeof item === "object" && item.id;
      });

      if (isMounted.current) {
        setFavorites(validatedFavorites);
        setError(null);
        setRetryCount(0);
      }
    } catch (error) {
      console.error("Failed to fetch favorites:", error);
      
      let errorMessage = t("error") || "Failed to load favorites";
      
      if (error.response) {
        // Handle different HTTP status codes
        if (error.response.status === 401) {
          errorMessage = t("session_expired") || "Session expired. Please login again.";
          // Redirect to login after delay
          setTimeout(() => {
            if (isMounted.current) {
              navigate("/login");
            }
          }, 2000);
        } else if (error.response.status === 404) {
          errorMessage = t("no_favorites") || "No favorites found";
        } else if (error.response.status === 500) {
          errorMessage = t("server_error") || "Server error. Please try again later.";
        }
      } else if (error.code === "ECONNABORTED") {
        errorMessage = t("request_timeout") || "Request timed out. Please try again.";
      }

      if (isMounted.current) {
        setError(errorMessage);
        setFavorites([]);
        
        // Only show toast for non-retry or final error
        if (!isRetry || retryCount >= 2) {
          toast.error(t("error"), {
            description: errorMessage,
          });
        }
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        fetchInProgress.current = false;
      }
    }
  }, [token, t, navigate, retryCount]);

  // Initial fetch
  useEffect(() => {
    isMounted.current = true;

    if (authLoading) {
      return;
    }

    if (!token || !user) {
      toast.error(t("error"), {
        description: t("please_login") || "Please login to view favorites",
      });
      navigate("/");
      return;
    }

    fetchFavorites();

    // Cleanup function
    return () => {
      isMounted.current = false;
      fetchInProgress.current = false;
    };
  }, [token, authLoading, user, navigate, fetchFavorites, t]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
    fetchFavorites(true);
  }, [fetchFavorites]);

  // Navigate to ad detail safely
  const handleAdClick = useCallback((adId) => {
    if (!adId) {
      toast.error(t("error"), { description: "Invalid ad" });
      return;
    }
    navigate(`/ad/${String(adId)}`);
  }, [navigate, t]);

  // Navigate to browse ads
  const handleBrowseAds = useCallback(() => {
    navigate("/");
  }, [navigate]);

  // Render empty state
  const renderEmptyState = () => (
    <div className="text-center py-16" data-testid="empty-state">
      <Heart className="w-16 h-16 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-zinc-950 dark:text-white mb-2">
        {t("no_favorites") || "No favorites yet"}
      </h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        {t("no_favorites_description") || "Start saving your favorite ads by clicking the heart icon"}
      </p>
      <Button
        onClick={handleBrowseAds}
        className="bg-red-600 hover:bg-red-700 text-white"
        data-testid="browse-ads-btn"
      >
        {t("browse_ads") || "Browse Ads"}
      </Button>
    </div>
  );

  // Render error state
  const renderErrorState = () => (
    <div className="text-center py-16" data-testid="error-state">
      <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-zinc-950 dark:text-white mb-2">
        {t("error_loading") || "Error loading favorites"}
      </h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        {error || t("try_again") || "Please try again"}
      </p>
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

  // Render favorites grid
  const renderFavorites = () => {
    if (!Array.isArray(favorites) || favorites.length === 0) {
      return renderEmptyState();
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {favorites.map((ad) => {
          // Safely extract ad data
          const adId = ad.id ? String(ad.id) : null;
          const title = sanitizeText(ad.title) || "Untitled";
          const price = formatPrice(ad.price);
          const views = safeNumber(ad.views);
          const images = toArray(ad.images);
          const location = ad.location?.address || "Samarqand";
          const createdAt = ad.created_at ? new Date(ad.created_at) : null;
          const isActive = ad.status === "active";

          return (
            <div
              key={adId || Math.random().toString()}
              className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-200 cursor-pointer group bg-white dark:bg-zinc-900"
              onClick={() => handleAdClick(adId)}
              data-testid={`favorite-ad-${adId}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleAdClick(adId);
                }
              }}
            >
              {/* Image Container */}
              <div className="relative h-48 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
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
                    <Heart className="w-12 h-12 opacity-20" />
                  </div>
                )}
                
                {/* Status Badge */}
                {!isActive && (
                  <div className="absolute top-3 left-3 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                    {t("inactive") || "Inactive"}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-bold text-zinc-950 dark:text-white mb-2 line-clamp-2 group-hover:text-red-600 transition-colors">
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
                    <span>{views} {t("views") || "views"}</span>
                  </div>
                  <div className="text-xs truncate max-w-[100px]">
                    {location}
                  </div>
                </div>

                {createdAt && (
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                    {createdAt.toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="favorites-page">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black text-zinc-950 dark:text-white">
            {t("favorites") || "Favorites"}
          </h1>
          {!loading && !error && Array.isArray(favorites) && favorites.length > 0 && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {favorites.length} {t("items") || "items"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : error ? (
          renderErrorState()
        ) : (
          renderFavorites()
        )}
      </div>
    </div>
  );
};

export default Favorites;

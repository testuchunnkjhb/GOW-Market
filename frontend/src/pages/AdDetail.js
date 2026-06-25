import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Heart, Eye, Phone, MessageCircle, MapPin, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "object") {
    if (Array.isArray(value.data)) return value.data;
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.results)) return value.results;
    return [];
  }
  return [];
};

const safeObject = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
};

const safeString = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

const formatDate = (date) => {
  if (!date) return "Unknown";
  try {
    return date.toLocaleDateString();
  } catch {
    return "Unknown";
  }
};

const formatPrice = (price) => {
  const num = safeNumber(price);
  if (num === 0) return null;
  try {
    return new Intl.NumberFormat("uz-UZ").format(num);
  } catch {
    return String(num);
  }
};

const AdDetail = () => {
  const { id } = useParams();
  const { t, language } = useLanguage();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [ad, setAd] = useState(null);
  const [similarAds, setSimilarAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const fetchInProgress = useRef(false);

  const fetchAd = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setError("Invalid ad ID");
      return;
    }

    if (fetchInProgress.current) {
      return;
    }

    fetchInProgress.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API}/ads/${id}`, {
        timeout: 8000,
      });

      const adData = safeObject(response.data);
      setAd(adData);

      const categoryId = adData.category_id;
      if (categoryId) {
        try {
          const similarResponse = await axios.get(`${API}/ads`, {
            params: {
              category_id: categoryId,
              limit: 5,
            },
            timeout: 8000,
          });
          const similarData = safeArray(similarResponse.data);
          const filtered = similarData.filter((item) => safeString(item.id) !== safeString(id));
          setSimilarAds(filtered.slice(0, 4));
        } catch (similarError) {
          console.error("Failed to fetch similar ads:", similarError);
          setSimilarAds([]);
        }
      } else {
        setSimilarAds([]);
      }

      if (token) {
        try {
          const favResponse = await axios.get(`${API}/favorites`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 8000,
          });
          const favorites = safeArray(favResponse.data);
          const isFav = favorites.some((fav) => safeString(fav.ad_id) === safeString(id));
          setIsFavorite(isFav);
        } catch (favError) {
          console.error("Failed to fetch favorites:", favError);
          setIsFavorite(false);
        }
      }
    } catch (error) {
      console.error("Failed to fetch ad:", error);
      setError(t("failed_to_load_ad") || "Failed to load ad");
      toast.error(t("error"), {
        description: t("failed_to_load_ad") || "Failed to load ad",
      });
      setAd(null);
      setSimilarAds([]);
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
    }
  }, [id, token, t]);

  useEffect(() => {
    fetchAd();
    return () => {
      fetchInProgress.current = false;
    };
  }, [fetchAd]);

  const toggleFavorite = useCallback(async () => {
    if (!token) {
      toast.error(t("error"), {
        description: t("please_login_first") || "Please login first",
      });
      return;
    }

    if (!id) {
      toast.error(t("error"), { description: "Invalid ad ID" });
      return;
    }

    try {
      await axios.post(
        `${API}/favorites/toggle`,
        { ad_id: id },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000,
        }
      );
      setIsFavorite((prev) => !prev);
      toast.success(t("success"));
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      toast.error(t("error"), {
        description: t("failed_to_update_favorite") || "Failed to update favorite",
      });
    }
  }, [token, id, t]);

  const handleChat = useCallback(() => {
    if (!token) {
      toast.error(t("error"), {
        description: t("please_login_first") || "Please login first",
      });
      return;
    }
    if (!ad) {
      toast.error(t("error"), { description: "Ad not found" });
      return;
    }
    const userId = safeString(ad.user_id);
    if (!userId) {
      toast.error(t("error"), { description: "Seller information not available" });
      return;
    }
    navigate(`/messages?ad=${safeString(id)}&user=${userId}`);
  }, [token, ad, id, navigate, t]);

  const handleCall = useCallback((phoneNumber) => {
    const phone = safeString(phoneNumber);
    if (!phone) {
      toast.error(t("error"), { description: "Phone number not available" });
      return;
    }
    try {
      window.location.href = `tel:${phone}`;
    } catch {
      toast.error(t("error"), { description: "Failed to make call" });
    }
  }, [t]);

  const handleNavigateToAd = useCallback(
    (adId) => {
      if (adId) {
        navigate(`/ad/${safeString(adId)}`);
      }
    },
    [navigate]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <div className="text-zinc-600 dark:text-zinc-400">
            {t("loading") || "Loading..."}
          </div>
        </div>
      </div>
    );
  }

  if (error || !ad) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <div className="text-zinc-600 dark:text-zinc-400">
            {error || t("ad_not_found") || "Ad not found"}
          </div>
          <Button
            onClick={() => navigate("/")}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white"
          >
            {t("back_to_home") || "Back to Home"}
          </Button>
        </div>
      </div>
    );
  }

  const adImages = safeArray(ad.images);
  const adTitle = safeString(ad.title);
  const adPrice = ad.price;
  const adDescription = safeString(ad.description);
  const adViews = safeNumber(ad.views);
  const adCreatedAt = safeDate(ad.created_at);
  const adLocation = safeObject(ad.location);
  const adAddress = safeString(adLocation.address, "Samarqand");
  const adLandmark = safeString(adLocation.landmark);
  const adCanDeliver = ad.can_deliver === true;
  const adContactName = safeString(ad.contact_name);
  const adContactPhone = safeString(ad.contact_phone);
  const adContactMethods = safeArray(ad.contact_methods);
  const adCharacteristics = safeObject(ad.characteristics);

  const renderImages = () => {
    if (adImages.length === 0) {
      return (
        <div className="h-96 flex items-center justify-center text-zinc-400">
          {t("no_images") || "No images available"}
        </div>
      );
    }

    return (
      <Carousel>
        <CarouselContent>
          {adImages.map((img, index) => (
            <CarouselItem key={index}>
              <div className="h-96">
                <img
                  src={`${API}/files/${safeString(img)}`}
                  alt={`${adTitle} - ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src =
                      "https://images.pexels.com/photos/19439173/pexels-photo-19439173.jpeg";
                  }}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {adImages.length > 1 && (
          <>
            <CarouselPrevious className="left-4" />
            <CarouselNext className="right-4" />
          </>
        )}
      </Carousel>
    );
  };

  const renderCharacteristics = () => {
    const entries = Object.entries(adCharacteristics);
    if (entries.length === 0) return null;

    return (
      <div className="mt-6 space-y-2">
        <h3 className="text-xl font-bold">
          {t("characteristics") || "Characteristics"}
        </h3>
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex justify-between py-2 border-b border-zinc-200 dark:border-zinc-800"
          >
            <span className="text-zinc-600 dark:text-zinc-400">
              {safeString(key)}
            </span>
            <span className="font-medium text-zinc-950 dark:text-white">
              {safeString(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderSellerInfo = () => {
    return (
      <div
        className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 sticky top-20"
        data-testid="seller-info"
      >
        <h3 className="text-lg font-bold mb-4">
          {t("contact_seller") || "Contact Seller"}
        </h3>

        <div className="space-y-4">
          <div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
              {t("name") || "Name"}
            </div>
            <div className="font-bold text-zinc-950 dark:text-white">
              {adContactName || "Unknown"}
            </div>
          </div>

          <div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
              {t("phone_number") || "Phone Number"}
            </div>
            <div className="font-bold text-zinc-950 dark:text-white">
              {adContactPhone || "Not provided"}
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            {adContactMethods.includes("chat") && (
              <Button
                onClick={handleChat}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                data-testid="chat-btn"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                {t("chat") || "Chat"}
              </Button>
            )}

            {adContactMethods.includes("call") && adContactPhone && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleCall(adContactPhone)}
                data-testid="call-btn"
              >
                <Phone className="w-4 h-4 mr-2" />
                {t("call") || "Call"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSimilarAds = () => {
    if (similarAds.length === 0) return null;

    return (
      <div className="mt-12" data-testid="similar-ads">
        <h2 className="text-2xl font-black text-zinc-950 dark:text-white mb-6">
          {t("similar_ads") || "Similar Ads"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {similarAds.slice(0, 4).map((similarAd) => {
            const similarImages = safeArray(similarAd.images);
            const similarTitle = safeString(similarAd.title);
            const similarPrice = similarAd.price;
            const similarId = safeString(similarAd.id);

            return (
              <div
                key={similarId}
                onClick={() => handleNavigateToAd(similarId)}
                className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-lg transition"
                data-testid={`similar-ad-${similarId}`}
              >
                <div className="h-40 bg-zinc-100 dark:bg-zinc-800">
                  {similarImages.length > 0 && similarImages[0] ? (
                    <img
                      src={`${API}/files/${safeString(similarImages[0])}`}
                      alt={similarTitle}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src =
                          "https://images.pexels.com/photos/19439173/pexels-photo-19439173.jpeg";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400">
                      {t("no_image") || "No image"}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-zinc-950 dark:text-white mb-2 line-clamp-2">
                    {similarTitle}
                  </h3>
                  {similarPrice != null && (
                    <div className="text-lg font-black text-red-600">
                      {formatPrice(similarPrice)} UZS
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
        data-testid="ad-detail-page"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div
              className="bg-zinc-100 dark:bg-zinc-900 rounded-lg overflow-hidden"
              data-testid="image-gallery"
            >
              {renderImages()}
            </div>

            <div
              className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6"
              data-testid="ad-info"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-black text-zinc-950 dark:text-white mb-2">
                    {adTitle}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>
                        {adViews} {t("views") || "views"}
                      </span>
                    </div>
                    <div>{formatDate(adCreatedAt)}</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleFavorite}
                  data-testid="favorite-detail-btn"
                >
                  <Heart
                    className={`w-5 h-5 ${
                      isFavorite ? "fill-red-600 text-red-600" : ""
                    }`}
                  />
                </Button>
              </div>

              {adPrice != null && (
                <div className="text-4xl font-black text-red-600 mb-6">
                  {formatPrice(adPrice)} UZS
                </div>
              )}

              <div className="prose dark:prose-invert max-w-none">
                <h3 className="text-xl font-bold mb-2">
                  {t("description") || "Description"}
                </h3>
                <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                  {adDescription || "No description provided"}
                </p>
              </div>

              {renderCharacteristics()}
            </div>

            <div
              className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6"
              data-testid="location-info"
            >
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                {t("location") || "Location"}
              </h3>
              <div className="space-y-2">
                <p className="text-zinc-700 dark:text-zinc-300">{adAddress}</p>
                {adLandmark && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t("landmark") || "Landmark"}: {adLandmark}
                  </p>
                )}
                {adCanDeliver && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">
                      {t("can_deliver") || "Can deliver"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">{renderSellerInfo()}</div>
        </div>

        {renderSimilarAds()}
      </div>
    </div>
  );
};

export default AdDetail;

import { useState, useEffect, useCallback } from "react";
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

const AdDetail = () => {
  const { id } = useParams();
  const { t, language } = useLanguage();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [ad, setAd] = useState(null);
  const [seller, setSeller] = useState(null);
  const [similarAds, setSimilarAds] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAd = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/ads/${id}`);
      setAd(response.data);
      
      const userResponse = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${response.data.user_id}` }
      }).catch(() => null);
      
      if (userResponse) {
        setSeller(userResponse.data);
      }

      const similarResponse = await axios.get(
        `${API}/ads?category_id=${response.data.category_id}&limit=4`
      );
      setSimilarAds(similarResponse.data.filter(a => a.id !== id));
    } catch (error) {
      console.error("Failed to fetch ad:", error);
      toast.error(t("error"), { description: t("failed_to_load_ad") });
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchAd();
  }, [fetchAd]);

  const toggleFavorite = useCallback(async () => {
    if (!token) {
      toast.error(t("error"), { description: t("please_login_first") });
      return;
    }

    try {
      await axios.post(
        `${API}/favorites/toggle`,
        { ad_id: id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t("success"));
    } catch (error) {
      toast.error(t("error"), { description: t("failed_to_update_favorite") });
    }
  }, [token, id, t]);

  const handleChat = useCallback(() => {
    if (!token) {
      toast.error(t("error"), { description: t("please_login_first") });
      return;
    }
    navigate(`/messages?ad=${id}&user=${ad?.user_id}`);
  }, [token, id, ad?.user_id, navigate, t]);

  const handleCall = useCallback((phoneNumber) => {
    window.location.href = `tel:${phoneNumber}`;
  }, []);

  const handleNavigateToAd = useCallback((adId) => {
    navigate(`/ad/${adId}`);
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <div className="text-zinc-600 dark:text-zinc-400">{t("loading")}</div>
        </div>
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <div className="text-zinc-600 dark:text-zinc-400">{t("ad_not_found")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="ad-detail-page">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg overflow-hidden" data-testid="image-gallery">
              {ad.images && ad.images.length > 0 ? (
                <Carousel>
                  <CarouselContent>
                    {ad.images.map((img, index) => (
                      <CarouselItem key={index}>
                        <div className="h-96">
                          <img
                            src={`${API}/files/${img}`}
                            alt={`${ad.title} - ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = "https://images.pexels.com/photos/19439173/pexels-photo-19439173.jpeg";
                            }}
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {ad.images.length > 1 && (
                    <>
                      <CarouselPrevious className="left-4" />
                      <CarouselNext className="right-4" />
                    </>
                  )}
                </Carousel>
              ) : (
                <div className="h-96 flex items-center justify-center text-zinc-400">
                  {t("no_images")}
                </div>
              )}
            </div>

            {/* Ad Info */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6" data-testid="ad-info">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-black text-zinc-950 dark:text-white mb-2">
                    {ad.title}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{ad.views} {t("views")}</span>
                    </div>
                    <div>{new Date(ad.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleFavorite}
                  data-testid="favorite-detail-btn"
                >
                  <Heart className="w-5 h-5" />
                </Button>
              </div>

              {ad.price && (
                <div className="text-4xl font-black text-red-600 mb-6">
                  {new Intl.NumberFormat('uz-UZ').format(ad.price)} UZS
                </div>
              )}

              <div className="prose dark:prose-invert max-w-none">
                <h3 className="text-xl font-bold mb-2">{t("description")}</h3>
                <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                  {ad.description}
                </p>
              </div>

              {ad.characteristics && Object.keys(ad.characteristics).length > 0 && (
                <div className="mt-6 space-y-2">
                  <h3 className="text-xl font-bold">{t("characteristics")}</h3>
                  {Object.entries(ad.characteristics).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
                      <span className="text-zinc-600 dark:text-zinc-400">{key}</span>
                      <span className="font-medium text-zinc-950 dark:text-white">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Location */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6" data-testid="location-info">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                {t("location")}
              </h3>
              <div className="space-y-2">
                <p className="text-zinc-700 dark:text-zinc-300">
                  {ad.location?.address || "Samarqand"}
                </p>
                {ad.location?.landmark && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t("landmark")}: {ad.location.landmark}
                  </p>
                )}
                {ad.can_deliver && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">{t("can_deliver")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Seller Info */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 sticky top-20" data-testid="seller-info">
              <h3 className="text-lg font-bold mb-4">{t("contact_seller")}</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">{t("name")}</div>
                  <div className="font-bold text-zinc-950 dark:text-white">{ad.contact_name}</div>
                </div>

                <div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">{t("phone_number")}</div>
                  <div className="font-bold text-zinc-950 dark:text-white">{ad.contact_phone}</div>
                </div>

                <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  {ad.contact_methods && ad.contact_methods.includes("chat") && (
                    <Button
                      onClick={handleChat}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                      data-testid="chat-btn"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      {t("chat")}
                    </Button>
                  )}
                  
                  {ad.contact_methods && ad.contact_methods.includes("call") && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleCall(ad.contact_phone)}
                      data-testid="call-btn"
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      {t("call")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Similar Ads */}
        {similarAds.length > 0 && (
          <div className="mt-12" data-testid="similar-ads">
            <h2 className="text-2xl font-black text-zinc-950 dark:text-white mb-6">
              {t("similar_ads")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {similarAds.slice(0, 4).map((similarAd) => (
                <div
                  key={similarAd.id}
                  onClick={() => handleNavigateToAd(similarAd.id)}
                  className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-lg transition"
                  data-testid={`similar-ad-${similarAd.id}`}
                >
                  <div className="h-40 bg-zinc-100 dark:bg-zinc-800">
                    {similarAd.images && similarAd.images[0] && (
                      <img
                        src={`${API}/files/${similarAd.images[0]}`}
                        alt={similarAd.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = "https://images.pexels.com/photos/19439173/pexels-photo-19439173.jpeg";
                        }}
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-zinc-950 dark:text-white mb-2 line-clamp-2">
                      {similarAd.title}
                    </h3>
                    {similarAd.price && (
                      <div className="text-lg font-black text-red-600">
                        {new Intl.NumberFormat('uz-UZ').format(similarAd.price)} UZS
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdDetail;

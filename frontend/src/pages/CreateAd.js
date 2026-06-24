import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CreateAd = () => {
  const { t, language } = useLanguage();
  const { token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    category_id: "",
    price: "",
    description: "",
    location: {
      address: "Samarqand",
      landmark: ""
    },
    contact_name: "",
    contact_phone: "",
    contact_methods: [],
    can_deliver: false
  });
  
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!token) {
      toast.error(t("error"), { description: "Please login first" });
      navigate("/");
      return;
    }
    fetchCategories();
  }, [token, authLoading, navigate]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/categories`);
      setCategories(response.data);
    } catch (error) {
      toast.error(t("error"));
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    
    if (images.length + files.length > 10) {
      toast.error(t("error"), { description: "Maximum 10 images allowed" });
      return;
    }

    const newImages = [...images, ...files];
    setImages(newImages);

    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...newPreviews]);
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  const handleContactMethodToggle = (method) => {
    const methods = formData.contact_methods.includes(method)
      ? formData.contact_methods.filter(m => m !== method)
      : [...formData.contact_methods, method];
    
    setFormData({ ...formData, contact_methods: methods });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.category_id) {
      toast.error(t("error"), { description: "Please select a category" });
      return;
    }

    if (formData.contact_methods.length === 0) {
      toast.error(t("error"), { description: "Please select at least one contact method" });
      return;
    }

    setLoading(true);

    try {
      const adData = {
        ...formData,
        price: formData.price ? parseFloat(formData.price) : null
      };

      const response = await axios.post(`${API}/ads`, adData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const adId = response.data.id;

      for (const image of images) {
        const formDataImg = new FormData();
        formDataImg.append("file", image);
        
        await axios.post(`${API}/ads/${adId}/upload`, formDataImg, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data"
          }
        });
      }

      toast.success(t("success"), { description: "Ad created successfully!" });
      navigate("/profile");
    } catch (error) {
      console.error("Failed to create ad:", error);
      toast.error(t("error"), { description: error.response?.data?.detail || "Failed to create ad" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="create-ad-page">
        <h1 className="text-3xl font-black text-zinc-950 dark:text-white mb-8">
          {t("create_new_ad")}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Photos */}
          <div className="space-y-4" data-testid="photos-section">
            <Label className="text-lg font-bold">{t("photos")}</Label>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("upload_photos")}</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative aspect-square border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                  <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                    data-testid={`remove-image-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              {images.length < 10 && (
                <label className="aspect-square border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition" data-testid="upload-image-btn">
                  <Upload className="w-8 h-8 text-zinc-400 mb-2" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{t("drag_drop")}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t("title")}</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t("title_placeholder")}
              required
              data-testid="title-input"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>{t("category")}</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => setFormData({ ...formData, category_id: value })}
            >
              <SelectTrigger data-testid="category-select">
                <SelectValue placeholder={t("select_category")} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} data-testid={`category-option-${cat.id}`}>
                    {language === "uz" ? cat.name_uz : cat.name_ru}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">{t("price_label")}</Label>
            <Input
              id="price"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0"
              data-testid="price-input"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t("description_label")}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t("description_placeholder")}
              rows={6}
              maxLength={1000}
              required
              data-testid="description-input"
            />
            <p className="text-xs text-zinc-500 text-right">{formData.description.length}/1000</p>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <Label className="text-lg font-bold">{t("deal_location")}</Label>
            <div className="space-y-2">
              <Label htmlFor="address">{t("address")}</Label>
              <Input
                id="address"
                value={formData.location.address}
                onChange={(e) => setFormData({ ...formData, location: { ...formData.location, address: e.target.value } })}
                required
                data-testid="address-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landmark">{t("landmark")}</Label>
              <Input
                id="landmark"
                value={formData.location.landmark}
                onChange={(e) => setFormData({ ...formData, location: { ...formData.location, landmark: e.target.value } })}
                placeholder="Oloy bozori"
                data-testid="landmark-input"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="can_deliver"
                checked={formData.can_deliver}
                onCheckedChange={(checked) => setFormData({ ...formData, can_deliver: checked })}
                data-testid="can-deliver-checkbox"
              />
              <Label htmlFor="can_deliver" className="cursor-pointer">{t("can_deliver")}</Label>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <Label className="text-lg font-bold">{t("contact_info")}</Label>
            <div className="space-y-2">
              <Label htmlFor="contact_name">{t("name")}</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                required
                data-testid="contact-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">{t("phone_number")}</Label>
              <Input
                id="contact_phone"
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="+998"
                required
                data-testid="contact-phone-input"
              />
            </div>
          </div>

          {/* Contact Methods */}
          <div className="space-y-4">
            <Label className="text-lg font-bold">{t("contact_methods")}</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="method_chat"
                  checked={formData.contact_methods.includes("chat")}
                  onCheckedChange={() => handleContactMethodToggle("chat")}
                  data-testid="contact-method-chat"
                />
                <Label htmlFor="method_chat" className="cursor-pointer">{t("chat_gow")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="method_call"
                  checked={formData.contact_methods.includes("call")}
                  onCheckedChange={() => handleContactMethodToggle("call")}
                  data-testid="contact-method-call"
                />
                <Label htmlFor="method_call" className="cursor-pointer">{t("call")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="method_telegram"
                  checked={formData.contact_methods.includes("telegram")}
                  onCheckedChange={() => handleContactMethodToggle("telegram")}
                  data-testid="contact-method-telegram"
                />
                <Label htmlFor="method_telegram" className="cursor-pointer">{t("telegram")}</Label>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/profile")}
              className="flex-1"
              data-testid="cancel-btn"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
              data-testid="publish-btn"
            >
              {loading ? t("loading") : t("publish")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAd;

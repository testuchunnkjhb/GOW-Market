import { useState, useEffect, useCallback, useRef } from "react";
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
const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SUBMISSION_COOLDOWN = 5000;

const sanitizeInput = (value) => {
  if (!value) return "";
  return value.replace(/[<>]/g, "");
};

const validateImageFile = (file) => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `Invalid file type: ${file.type}` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }
  return { valid: true };
};

const CreateAd = () => {
  const { t, language } = useLanguage();
  const { token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSubmission, setLastSubmission] = useState(0);
  const submissionRef = useRef(false);

  const [formData, setFormData] = useState({
    title: "",
    category_id: "",
    price: "",
    description: "",
    location: {
      address: "Samarqand",
      landmark: "",
    },
    contact_name: "",
    contact_phone: "",
    contact_methods: [],
    can_deliver: false,
  });

  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/categories`, {
        timeout: 8000,
      });
      const categoriesData = Array.isArray(response.data) ? response.data : [];
      setCategories(categoriesData);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      toast.error(t("error"), { description: t("failed_to_load_categories") });
      setCategories([]);
    }
  }, [t]);

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      toast.error(t("error"), { description: t("please_login_first") });
      navigate("/");
      return;
    }
    fetchCategories();
  }, [token, authLoading, navigate, fetchCategories, t]);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    if (images.length + files.length > MAX_IMAGES) {
      toast.error(t("error"), {
        description: `Maximum ${MAX_IMAGES} images allowed`,
      });
      e.target.value = "";
      return;
    }

    const validFiles = [];
    const errors = [];

    files.forEach((file) => {
      const validation = validateImageFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errors.push(validation.error);
      }
    });

    if (errors.length > 0) {
      toast.error(t("error"), { description: errors.join(", ") });
      e.target.value = "";
      return;
    }

    const newImages = [...images, ...validFiles];
    setImages(newImages);

    const newPreviews = validFiles.map((file) => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...newPreviews]);

    e.target.value = "";
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  const handleContactMethodToggle = (method) => {
    const methods = formData.contact_methods.includes(method)
      ? formData.contact_methods.filter((m) => m !== method)
      : [...formData.contact_methods, method];

    setFormData({ ...formData, contact_methods: methods });
  };

  const handleInputChange = (field, value) => {
    const sanitized = typeof value === "string" ? sanitizeInput(value) : value;
    setFormData({ ...formData, [field]: sanitized });
  };

  const handleLocationChange = (field, value) => {
    const sanitized = typeof value === "string" ? sanitizeInput(value) : value;
    setFormData({
      ...formData,
      location: { ...formData.location, [field]: sanitized },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submissionRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastSubmission < SUBMISSION_COOLDOWN) {
      toast.error(t("error"), {
        description: t("please_wait_before_submitting") || "Please wait before submitting again",
      });
      return;
    }

    if (!formData.title || formData.title.trim().length < 3) {
      toast.error(t("error"), { description: t("title_required") || "Title is required (min 3 chars)" });
      return;
    }

    if (!formData.category_id) {
      toast.error(t("error"), { description: t("select_category") || "Please select a category" });
      return;
    }

    if (!formData.description || formData.description.trim().length < 10) {
      toast.error(t("error"), { description: t("description_required") || "Description is required (min 10 chars)" });
      return;
    }

    if (!formData.contact_name || formData.contact_name.trim().length < 2) {
      toast.error(t("error"), { description: t("contact_name_required") || "Contact name is required" });
      return;
    }

    if (!formData.contact_phone || formData.contact_phone.trim().length < 5) {
      toast.error(t("error"), { description: t("phone_required") || "Valid phone number is required" });
      return;
    }

    if (formData.contact_methods.length === 0) {
      toast.error(t("error"), {
        description: t("contact_method_required") || "Please select at least one contact method",
      });
      return;
    }

    const priceValue = parseFloat(formData.price);
    if (formData.price && (isNaN(priceValue) || priceValue < 0 || priceValue > 999999999999)) {
      toast.error(t("error"), { description: t("invalid_price") || "Invalid price" });
      return;
    }

    submissionRef.current = true;
    setLastSubmission(now);
    setLoading(true);

    try {
      const adData = {
        title: formData.title.trim(),
        category_id: formData.category_id,
        price: formData.price ? parseFloat(formData.price) : null,
        description: formData.description.trim(),
        location: {
          address: formData.location.address.trim(),
          landmark: formData.location.landmark ? formData.location.landmark.trim() : "",
        },
        contact_name: formData.contact_name.trim(),
        contact_phone: formData.contact_phone.trim(),
        contact_methods: formData.contact_methods,
        can_deliver: formData.can_deliver,
      };

      const response = await axios.post(`${API}/ads`, adData, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
        withCredentials: true,
      });

      const adId = response.data?.id;
      if (!adId) {
        throw new Error("No ad ID returned from server");
      }

      if (images.length > 0) {
        const uploadPromises = images.map(async (image) => {
          const formDataImg = new FormData();
          formDataImg.append("file", image);

          await axios.post(`${API}/ads/${adId}/upload`, formDataImg, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
            timeout: 30000,
            withCredentials: true,
          });
        });

        await Promise.all(uploadPromises);
      }

      toast.success(t("success"), {
        description: t("ad_created_successfully") || "Ad created successfully!",
      });

      setFormData({
        title: "",
        category_id: "",
        price: "",
        description: "",
        location: {
          address: "Samarqand",
          landmark: "",
        },
        contact_name: "",
        contact_phone: "",
        contact_methods: [],
        can_deliver: false,
      });
      setImages([]);
      setImagePreviews([]);

      navigate(`/ad/${adId}`);
    } catch (error) {
      console.error("Failed to create ad:", error);

      const errorMessage = error.response?.data?.detail || error.message || "Failed to create ad";
      toast.error(t("error"), { description: errorMessage });

      if (error.response?.status === 401) {
        navigate("/login");
      }
    } finally {
      setLoading(false);
      submissionRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="create-ad-page">
        <h1 className="text-3xl font-black text-zinc-950 dark:text-white mb-8">
          {t("create_new_ad") || "Create New Ad"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8" noValidate>
          {/* Photos */}
          <div className="space-y-4" data-testid="photos-section">
            <Label className="text-lg font-bold">{t("photos") || "Photos"}</Label>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t("upload_photos") || "Upload up to 10 images (JPG, PNG, WebP, max 10MB each)"}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {imagePreviews.map((preview, index) => (
                <div
                  key={index}
                  className="relative aspect-square border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
                >
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
                    data-testid={`remove-image-${index}`}
                    aria-label="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {images.length < MAX_IMAGES && (
                <label className="aspect-square border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition">
                  <Upload className="w-8 h-8 text-zinc-400 mb-2" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t("drag_drop") || "Click to upload"}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                    {images.length}/{MAX_IMAGES}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t("title") || "Title"}</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder={t("title_placeholder") || "Enter ad title"}
              required
              maxLength={200}
              disabled={loading}
              data-testid="title-input"
            />
            <p className="text-xs text-zinc-500 text-right">{formData.title.length}/200</p>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>{t("category") || "Category"}</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => handleInputChange("category_id", value)}
              disabled={loading}
            >
              <SelectTrigger data-testid="category-select">
                <SelectValue placeholder={t("select_category") || "Select a category"} />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(categories) &&
                  categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} data-testid={`category-option-${cat.id}`}>
                      {language === "uz" ? cat.name_uz : cat.name_ru}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">{t("price_label") || "Price (UZS)"}</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="1000"
              value={formData.price}
              onChange={(e) => handleInputChange("price", e.target.value)}
              placeholder="0"
              disabled={loading}
              data-testid="price-input"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t("description_label") || "Description"}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder={t("description_placeholder") || "Describe your item in detail..."}
              rows={6}
              maxLength={5000}
              required
              disabled={loading}
              data-testid="description-input"
            />
            <p className="text-xs text-zinc-500 text-right">{formData.description.length}/5000</p>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <Label className="text-lg font-bold">{t("deal_location") || "Location"}</Label>
            <div className="space-y-2">
              <Label htmlFor="address">{t("address") || "Address"}</Label>
              <Input
                id="address"
                value={formData.location.address}
                onChange={(e) => handleLocationChange("address", e.target.value)}
                required
                disabled={loading}
                data-testid="address-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landmark">{t("landmark") || "Landmark"}</Label>
              <Input
                id="landmark"
                value={formData.location.landmark}
                onChange={(e) => handleLocationChange("landmark", e.target.value)}
                placeholder="Oloy bozori"
                disabled={loading}
                data-testid="landmark-input"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="can_deliver"
                checked={formData.can_deliver}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, can_deliver: checked === true })
                }
                disabled={loading}
                data-testid="can-deliver-checkbox"
              />
              <Label htmlFor="can_deliver" className="cursor-pointer">
                {t("can_deliver") || "Can deliver"}
              </Label>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <Label className="text-lg font-bold">{t("contact_info") || "Contact Information"}</Label>
            <div className="space-y-2">
              <Label htmlFor="contact_name">{t("name") || "Your Name"}</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => handleInputChange("contact_name", e.target.value)}
                required
                maxLength={100}
                disabled={loading}
                data-testid="contact-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">{t("phone_number") || "Phone Number"}</Label>
              <Input
                id="contact_phone"
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => handleInputChange("contact_phone", e.target.value)}
                placeholder="+998 90 123 45 67"
                required
                maxLength={20}
                disabled={loading}
                data-testid="contact-phone-input"
              />
            </div>
          </div>

          {/* Contact Methods */}
          <div className="space-y-4">
            <Label className="text-lg font-bold">{t("contact_methods") || "Contact Methods"}</Label>
            <div className="space-y-2">
              {["chat", "call", "telegram"].map((method) => (
                <div key={method} className="flex items-center gap-2">
                  <Checkbox
                    id={`method_${method}`}
                    checked={formData.contact_methods.includes(method)}
                    onCheckedChange={() => handleContactMethodToggle(method)}
                    disabled={loading}
                    data-testid={`contact-method-${method}`}
                  />
                  <Label htmlFor={`method_${method}`} className="cursor-pointer">
                    {t(method) || method.charAt(0).toUpperCase() + method.slice(1)}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/profile")}
              className="flex-1"
              disabled={loading}
              data-testid="cancel-btn"
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
              data-testid="publish-btn"
            >
              {loading ? t("loading") || "Loading..." : t("publish") || "Publish"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAd;

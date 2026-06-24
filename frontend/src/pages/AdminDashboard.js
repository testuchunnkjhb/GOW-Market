import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  Users,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  CreditCard,
  TrendingUp,
  Calendar,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = () => {
  const { token, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [ads, setAds] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      toast.error("Xatolik");
    }
  }, [token]);

  const fetchAds = useCallback(async (status = null) => {
    setLoading(true);
    try {
      const url = status ? `${API}/admin/ads?status=${status}` : `${API}/admin/ads`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAds(response.data);
    } catch (error) {
      toast.error("Xatolik");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchPayments = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayments(response.data);
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!token || !user || user.role !== "admin") {
      navigate("/");
      return;
    }
    fetchStats();
    fetchAds("pending");
    fetchPayments();
  }, [token, user, authLoading, navigate, fetchStats, fetchAds, fetchPayments]);

  const handleAction = useCallback(async (adId, action) => {
    try {
      await axios.post(
        `${API}/admin/ads/action`,
        { ad_id: adId, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Muvaffaqiyatli");
      fetchStats();
      fetchAds(activeTab === "dashboard" ? "pending" : activeTab);
    } catch (error) {
      toast.error("Xatolik");
    }
  }, [token, activeTab, fetchStats, fetchAds]);

  const handleTabChange = useCallback((value) => {
    setActiveTab(value);
    if (value !== "dashboard" && value !== "payments") {
      fetchAds(value === "all" ? null : value);
    }
  }, [fetchAds]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <div className="text-zinc-600 dark:text-zinc-400">Yuklanmoqda...</div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="admin-dashboard">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-zinc-950 dark:text-white mb-2">
            Administrator Paneli
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            GOW Market boshqaruv tizimi
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-white dark:bg-zinc-900 p-1">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              🏠 Bosh sahifa
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">
              📢 Kutilayotgan
            </TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">
              ✅ Faol
            </TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-payments">
              💳 To'lovlar
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">
              📊 Barcha
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      Jami foydalanuvchilar
                    </p>
                    <p className="text-3xl font-black text-zinc-950 dark:text-white">
                      {stats.total_users || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      Jami e'lonlar
                    </p>
                    <p className="text-3xl font-black text-zinc-950 dark:text-white">
                      {stats.total_ads || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                    <FileText className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      Faol e'lonlar
                    </p>
                    <p className="text-3xl font-black text-green-600">
                      {stats.active_ads || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      Kutilayotgan
                    </p>
                    <p className="text-3xl font-black text-yellow-600">
                      {stats.pending_ads || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Revenue Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-6 bg-gradient-to-br from-red-500 to-red-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-100 mb-1">Jami daromad</p>
                    <p className="text-2xl font-black">
                      {new Intl.NumberFormat('uz-UZ').format(stats.total_revenue || 0)} UZS
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-red-100" />
                </div>
              </Card>

              <Card className="p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      Kunlik daromad
                    </p>
                    <p className="text-xl font-black text-zinc-950 dark:text-white">
                      {new Intl.NumberFormat('uz-UZ').format(stats.daily_revenue || 0)} UZS
                    </p>
                  </div>
                  <Calendar className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                </div>
              </Card>

              <Card className="p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      Haftalik daromad
                    </p>
                    <p className="text-xl font-black text-zinc-950 dark:text-white">
                      {new Intl.NumberFormat('uz-UZ').format(stats.weekly_revenue || 0)} UZS
                    </p>
                  </div>
                  <TrendingUp className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                </div>
              </Card>

              <Card className="p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      Oylik daromad
                    </p>
                    <p className="text-xl font-black text-zinc-950 dark:text-white">
                      {new Intl.NumberFormat('uz-UZ').format(stats.monthly_revenue || 0)} UZS
                    </p>
                  </div>
                  <CreditCard className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                </div>
              </Card>
            </div>

            {/* Pending Ads for Quick Review */}
            <div>
              <h2 className="text-xl font-bold text-zinc-950 dark:text-white mb-4">
                Tasdiqlash kutilayotgan e'lonlar
              </h2>
              {renderAdsList()}
            </div>
          </TabsContent>

          {/* Pending Ads Tab */}
          <TabsContent value="pending">
            <h2 className="text-xl font-bold text-zinc-950 dark:text-white mb-4">
              Kutilayotgan e'lonlar
            </h2>
            {renderAdsList()}
          </TabsContent>

          {/* Active Ads Tab */}
          <TabsContent value="active">
            <h2 className="text-xl font-bold text-zinc-950 dark:text-white mb-4">
              Faol e'lonlar
            </h2>
            {renderAdsList()}
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <h2 className="text-xl font-bold text-zinc-950 dark:text-white mb-4">
              To'lovlar tarixi
            </h2>
            {renderPaymentsList()}
          </TabsContent>

          {/* All Ads Tab */}
          <TabsContent value="all">
            <h2 className="text-xl font-bold text-zinc-950 dark:text-white mb-4">
              Barcha e'lonlar
            </h2>
            {renderAdsList()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

  function renderAdsList() {
    if (loading) {
      return (
        <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
          Yuklanmoqda...
        </div>
      );
    }

    if (ads.length === 0) {
      return (
        <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
          E'lonlar topilmadi
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {ads.map((ad) => (
          <Card
            key={ad.id}
            className="p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:shadow-lg transition"
            data-testid={`admin-ad-${ad.id}`}
          >
            <div className="flex gap-6">
              <div className="w-32 h-32 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
                {ad.images && ad.images[0] ? (
                  <img
                    src={`${API}/files/${ad.images[0]}`}
                    alt={ad.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = "https://images.pexels.com/photos/19439173/pexels-photo-19439173.jpeg";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">
                    Rasm yo'q
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-zinc-950 dark:text-white mb-2">
                  {ad.title}
                </h3>
                <p className="text-zinc-700 dark:text-zinc-300 mb-4 line-clamp-2">
                  {ad.description}
                </p>
                <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                  {ad.price && (
                    <div className="font-bold text-red-600">
                      {new Intl.NumberFormat('uz-UZ').format(ad.price)} UZS
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    <span>{ad.views}</span>
                  </div>
                  <div>{new Date(ad.created_at).toLocaleDateString('uz-UZ')}</div>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    ad.status === 'active' ? 'bg-green-100 text-green-800' :
                    ad.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {ad.status === 'active' ? 'Faol' : ad.status === 'pending' ? 'Kutilmoqda' : 'Rad etilgan'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/ad/${ad.id}`)}
                  data-testid={`view-ad-${ad.id}`}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ko'rish
                </Button>
                {ad.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleAction(ad.id, "approve")}
                      data-testid={`approve-ad-${ad.id}`}
                    >
                      ✅ Tasdiqlash
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAction(ad.id, "reject")}
                      data-testid={`reject-ad-${ad.id}`}
                    >
                      ❌ Rad etish
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  function renderPaymentsList() {
    if (payments.length === 0) {
      return (
        <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
          To'lovlar topilmadi
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {payments.map((payment) => (
          <Card
            key={payment.id}
            className="p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-zinc-950 dark:text-white">
                  {new Intl.NumberFormat('uz-UZ').format(payment.amount)} UZS
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {payment.payment_method.toUpperCase()} • {new Date(payment.created_at).toLocaleString('uz-UZ')}
                </p>
                {payment.transaction_id && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                    Transaction: {payment.transaction_id}
                  </p>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {payment.status === 'completed' ? 'To\'landi' : payment.status === 'pending' ? 'Kutilmoqda' : 'Bekor qilindi'}
              </span>
            </div>
          </Card>
        ))}
      </div>
    );
  }
};

export default AdminDashboard;

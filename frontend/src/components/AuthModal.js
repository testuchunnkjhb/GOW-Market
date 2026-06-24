import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthModal = ({ open, onClose }) => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Login state
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Register state
  const [regPhone, setRegPhone] = useState("");
  const [regName, setRegName] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!loginPhone.startsWith("+998") || loginPhone.length !== 13) {
      toast.error("Xatolik", { description: "Telefon raqami: +998 XX XXX XX XX" });
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, {
        phone: loginPhone,
        password: loginPassword
      });
      
      login(response.data.token, response.data.user);
      toast.success("Muvaffaqiyatli", { description: "Tizimga kirdingiz!" });
      onClose();
      resetForm();
    } catch (error) {
      toast.error("Xatolik", {
        description: error.response?.data?.detail || "Telefon yoki parol noto'g'ri"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!regPhone.startsWith("+998") || regPhone.length !== 13) {
      toast.error("Xatolik", { description: "Telefon raqami: +998 XX XXX XX XX" });
      return;
    }
    
    if (regPassword.length < 6) {
      toast.error("Xatolik", { description: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" });
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/register`, {
        phone: regPhone,
        name: regName,
        password: regPassword
      });
      
      // Auto login after registration
      const loginResp = await axios.post(`${API}/auth/login`, {
        phone: regPhone,
        password: regPassword
      });
      
      login(loginResp.data.token, loginResp.data.user);
      toast.success("Muvaffaqiyatli", { description: "Ro'yxatdan o'tdingiz!" });
      onClose();
      resetForm();
    } catch (error) {
      toast.error("Xatolik", {
        description: error.response?.data?.detail || "Ro'yxatdan o'tishda xatolik"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setLoginPhone("");
    setLoginPassword("");
    setRegPhone("");
    setRegName("");
    setRegPassword("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="auth-modal" aria-describedby="auth-modal-description">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">
            Tizimga kirish
          </DialogTitle>
          <p id="auth-modal-description" className="sr-only">
            GOW Market uchun autentifikatsiya
          </p>
        </DialogHeader>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Kirish</TabsTrigger>
            <TabsTrigger value="register">Ro'yxatdan o'tish</TabsTrigger>
          </TabsList>

          {/* Login Tab */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
              <div className="space-y-2">
                <Label htmlFor="login-phone">Telefon raqami</Label>
                <Input
                  id="login-phone"
                  type="tel"
                  placeholder="+998 XX XXX XX XX"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  className="focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white"
                  data-testid="login-phone-input"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="login-password">Parol</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Parolingizni kiriting"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white"
                  data-testid="login-password-input"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium"
                data-testid="login-submit-button"
              >
                {loading ? "Yuklanmoqda..." : "Kirish"}
              </Button>
            </form>
          </TabsContent>

          {/* Register Tab */}
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4" data-testid="register-form">
              <div className="space-y-2">
                <Label htmlFor="reg-phone">Telefon raqami</Label>
                <Input
                  id="reg-phone"
                  type="tel"
                  placeholder="+998 XX XXX XX XX"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white"
                  data-testid="register-phone-input"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-name">Ismingiz</Label>
                <Input
                  id="reg-name"
                  type="text"
                  placeholder="To'liq ismingiz"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white"
                  data-testid="register-name-input"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reg-password">Parol</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="Kamida 6 ta belgi"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white"
                  data-testid="register-password-input"
                  required
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium"
                data-testid="register-submit-button"
              >
                {loading ? "Yuklanmoqda..." : "Ro'yxatdan o'tish"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;

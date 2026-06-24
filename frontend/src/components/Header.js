import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Heart, FileText, MessageCircle, Sun, Moon, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AuthModal from "@/components/AuthModal";

const Header = () => {
  const { language, switchLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 glass bg-white/80 dark:bg-zinc-950/80"
        data-testid="header"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center" data-testid="logo-link">
              <div className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                GOW <span className="text-red-600">Market</span>
              </div>
            </Link>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-2xl mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <Input
                  type="text"
                  placeholder={t("search_placeholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white"
                  data-testid="search-input"
                />
              </div>
            </form>

            {/* Actions */}
            <div className="flex items-center gap-4">
              {/* Language Switcher */}
              <div className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1">
                <button
                  onClick={() => switchLanguage("uz")}
                  className={`px-3 py-1 text-sm font-medium rounded transition ${
                    language === "uz"
                      ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                  }`}
                  data-testid="language-uz-button"
                >
                  UZ
                </button>
                <button
                  onClick={() => switchLanguage("ru")}
                  className={`px-3 py-1 text-sm font-medium rounded transition ${
                    language === "ru"
                      ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                  }`}
                  data-testid="language-ru-button"
                >
                  RU
                </button>
              </div>

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="hover:bg-zinc-100 dark:hover:bg-zinc-900"
                data-testid="theme-toggle-button"
              >
                {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </Button>

              {user ? (
                <>
                  <Link to="/favorites">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      data-testid="favorites-link"
                    >
                      <Heart className="w-5 h-5" />
                    </Button>
                  </Link>

                  <Link to="/profile">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      data-testid="my-ads-link"
                    >
                      <FileText className="w-5 h-5" />
                    </Button>
                  </Link>

                  <Link to="/messages">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      data-testid="messages-link"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </Button>
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-zinc-100 dark:hover:bg-zinc-900"
                        data-testid="user-menu-button"
                      >
                        <User className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate("/profile")} data-testid="profile-link">
                        <User className="w-4 h-4 mr-2" />
                        {t("my_profile")}
                      </DropdownMenuItem>
                      {user.role === "admin" && (
                        <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="admin-link">
                          <FileText className="w-4 h-4 mr-2" />
                          {t("admin_panel")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={logout} data-testid="logout-button">
                        <LogOut className="w-4 h-4 mr-2" />
                        {t("logout")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button
                  onClick={() => setShowAuth(true)}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium"
                  data-testid="login-button"
                >
                  {t("login")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
};

export default Header;

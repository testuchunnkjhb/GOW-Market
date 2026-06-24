import { useState, useEffect, createContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Home from "@/pages/Home";
import AdDetail from "@/pages/AdDetail";
import CreateAd from "@/pages/CreateAd";
import Profile from "@/pages/Profile";
import Favorites from "@/pages/Favorites";
import Messages from "@/pages/Messages";
import AdminDashboard from "@/pages/AdminDashboard";
import { Toaster } from "sonner";

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <div className="App">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/ad/:id" element={<AdDetail />} />
                <Route path="/create" element={<CreateAd />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/admin" element={<AdminDashboard />} />
              </Routes>
              <Toaster position="top-right" richColors />
            </div>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;

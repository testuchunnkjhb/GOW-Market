import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { safeExtractArray } from "@/utils/apiHelpers";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Messages = () => {
  const { t } = useLanguage();
  const { token, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Safely extract array from response
      const conversationsArray = safeExtractArray(response.data);
      setConversations(conversationsArray);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      toast.error(t("error"));
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  const selectConversation = useCallback(async (conversation) => {
    setSelectedConversation(conversation);
    try {
      const response = await axios.get(
        `${API}/messages/${conversation.user.id}?ad_id=${conversation.ad.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Safely extract array from response
      const messagesArray = safeExtractArray(response.data);
      setMessages(messagesArray);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      toast.error(t("error"));
      setMessages([]);
    }
  }, [token, t]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!token) {
      navigate("/");
      return;
    }
    fetchConversations();
  }, [token, authLoading, navigate, fetchConversations]);

  useEffect(() => {
    const adId = searchParams.get("ad");
    const userId = searchParams.get("user");
    
    if (adId && userId && Array.isArray(conversations) && conversations.length > 0) {
      const conv = conversations.find(c => c.ad?.id === adId && c.user?.id === userId);
      if (conv) {
        selectConversation(conv);
      }
    }
  }, [searchParams, conversations, selectConversation]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const response = await axios.post(
        `${API}/messages`,
        {
          ad_id: selectedConversation.ad.id,
          receiver_id: selectedConversation.user.id,
          content: newMessage
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMessages([...messages, response.data]);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error(t("error"));
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="messages-page">
        <h1 className="text-3xl font-black text-zinc-950 dark:text-white mb-8">
          {t("messages")}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          {/* Conversations List */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <h2 className="font-bold text-zinc-950 dark:text-white">{t("messages")}</h2>
            </div>
            <div className="overflow-y-auto h-[calc(600px-60px)]">
              {loading ? (
                <div className="p-4 text-center text-zinc-600 dark:text-zinc-400">
                  {t("loading")}
                </div>
              ) : !Array.isArray(conversations) || conversations.length === 0 ? (
                <div className="p-4 text-center text-zinc-600 dark:text-zinc-400">
                  {t("no_results")}
                </div>
              ) : (
                conversations.map((conv, index) => (
                  <div
                    key={index}
                    onClick={() => selectConversation(conv)}
                    className={`p-4 border-b border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition ${
                      selectedConversation?.user?.id === conv.user?.id ? "bg-zinc-100 dark:bg-zinc-800" : ""
                    }`}
                    data-testid={`conversation-${index}`}
                  >
                    <div className="font-bold text-zinc-950 dark:text-white mb-1">
                      {conv.user?.name || "Unknown"}
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-1">
                      {conv.ad?.title || "Ad deleted"}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 line-clamp-1">
                      {conv.last_message?.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-2 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden flex flex-col">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <div className="font-bold text-zinc-950 dark:text-white">
                    {selectedConversation.user?.name || "Unknown"}
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    {selectedConversation.ad?.title}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="messages-container">
                  {Array.isArray(messages) && messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_id === user.id ? "justify-end" : "justify-start"}`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          msg.sender_id === user.id
                            ? "bg-red-600 text-white"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white"
                        }`}
                      >
                        <div className="break-words">{msg.content}</div>
                        <div className="text-xs mt-1 opacity-70">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input */}
                <form onSubmit={sendMessage} className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={t("message")}
                      className="flex-1"
                      data-testid="message-input"
                    />
                    <Button
                      type="submit"
                      className="bg-red-600 hover:bg-red-700 text-white"
                      data-testid="send-message-btn"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 dark:text-zinc-400">
                {t("no_results")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;

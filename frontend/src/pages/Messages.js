import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, ArrowLeft, User, MessageCircle, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Safe array normalization
const toArray = (data) => {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  if (typeof data === "object") {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.messages)) return data.messages;
    if (Array.isArray(data.conversations)) return data.conversations;
    return [];
  }
  return [];
};

// Safe text sanitization
const sanitizeText = (text) => {
  if (!text) return "";
  return String(text).replace(/[<>]/g, "");
};

// Safe string
const safeString = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

// Safe number
const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

// Safe date formatting
const formatMessageDate = (date) => {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diff = now - d;
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
};

// Get initials from name
const getInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Skeleton component for conversations
const SkeletonConversation = () => (
  <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700"></div>
      <div className="flex-1">
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2"></div>
      </div>
    </div>
  </div>
);

// Skeleton for messages
const SkeletonMessage = ({ isOwn }) => (
  <div className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-pulse`}>
    <div className={`max-w-[70%] p-3 rounded-lg ${
      isOwn ? "bg-red-200 dark:bg-red-800/30" : "bg-zinc-200 dark:bg-zinc-700"
    }`}>
      <div className="h-4 bg-zinc-300 dark:bg-zinc-600 rounded w-32"></div>
    </div>
  </div>
);

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
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const messagesEndRef = useRef(null);
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch conversations
  const fetchConversations = useCallback(async (isRetry = false) => {
    if (fetchInProgress.current) return;
    if (!token) {
      setLoading(false);
      return;
    }

    fetchInProgress.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API}/messages/conversations`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
        withCredentials: true,
      });

      const conversationsArray = toArray(response.data);
      const validatedConversations = conversationsArray.filter(
        (item) => item && typeof item === "object"
      );

      if (isMounted.current) {
        setConversations(validatedConversations);
        setError(null);
        setRetryCount(0);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);

      let errorMessage = t("error") || "Failed to load conversations";

      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = t("session_expired") || "Session expired. Please login again.";
          setTimeout(() => {
            if (isMounted.current) {
              navigate("/login");
            }
          }, 2000);
        } else if (error.response.status === 500) {
          errorMessage = t("server_error") || "Server error. Please try again later.";
        }
      } else if (error.code === "ECONNABORTED") {
        errorMessage = t("request_timeout") || "Request timed out. Please try again.";
      }

      if (isMounted.current) {
        setError(errorMessage);
        setConversations([]);
        if (!isRetry || retryCount >= 2) {
          toast.error(t("error"), { description: errorMessage });
        }
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        fetchInProgress.current = false;
      }
    }
  }, [token, t, navigate, retryCount]);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversation) => {
    if (!conversation || !token) return;

    try {
      const userId = safeString(conversation.user?.id);
      const adId = safeString(conversation.ad?.id);

      if (!userId || !adId) {
        setMessages([]);
        return;
      }

      const response = await axios.get(`${API}/messages/${userId}?ad_id=${adId}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
        withCredentials: true,
      });

      const messagesArray = toArray(response.data);
      const validatedMessages = messagesArray.filter(
        (item) => item && typeof item === "object" && item.id
      );

      if (isMounted.current) {
        setMessages(validatedMessages);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      if (isMounted.current) {
        setMessages([]);
        toast.error(t("error"), {
          description: t("failed_to_load_messages") || "Failed to load messages",
        });
      }
    }
  }, [token, t]);

  // Select a conversation
  const selectConversation = useCallback(async (conversation) => {
    if (!conversation) return;

    setSelectedConversation(conversation);
    setMessages([]);
    await fetchMessages(conversation);
  }, [fetchMessages]);

  // Initial load
  useEffect(() => {
    isMounted.current = true;

    if (authLoading) return;

    if (!token || !user) {
      toast.error(t("error"), {
        description: t("please_login") || "Please login to view messages",
      });
      navigate("/");
      return;
    }

    fetchConversations();

    return () => {
      isMounted.current = false;
      fetchInProgress.current = false;
    };
  }, [token, authLoading, user, navigate, fetchConversations, t]);

  // Handle URL params for direct conversation selection
  useEffect(() => {
    const adId = searchParams.get("ad");
    const userId = searchParams.get("user");

    if (!adId || !userId) return;
    if (!Array.isArray(conversations) || conversations.length === 0) return;

    const conv = conversations.find(
      (c) => safeString(c.ad?.id) === safeString(adId) && 
             safeString(c.user?.id) === safeString(userId)
    );

    if (conv && (!selectedConversation || 
        safeString(selectedConversation.user?.id) !== safeString(userId))) {
      selectConversation(conv);
    }
  }, [searchParams, conversations, selectedConversation, selectConversation]);

  // Send message
  const sendMessage = useCallback(async (e) => {
    e.preventDefault();

    const messageText = newMessage.trim();
    if (!messageText) {
      toast.error(t("error"), { description: t("message_empty") || "Message cannot be empty" });
      return;
    }

    if (!selectedConversation) {
      toast.error(t("error"), { description: t("no_conversation_selected") || "No conversation selected" });
      return;
    }

    if (!token) {
      toast.error(t("error"), { description: t("please_login") || "Please login" });
      return;
    }

    setSending(true);

    try {
      const response = await axios.post(
        `${API}/messages`,
        {
          ad_id: safeString(selectedConversation.ad?.id),
          receiver_id: safeString(selectedConversation.user?.id),
          content: sanitizeText(messageText),
        },
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
          withCredentials: true,
        }
      );

      const newMessageData = response.data;
      if (newMessageData && newMessageData.id) {
        setMessages((prev) => [...prev, newMessageData]);
        setNewMessage("");
        
        // Update conversation list with new message
        setConversations((prev) => {
          const updated = [...prev];
          const index = updated.findIndex(
            (c) => safeString(c.user?.id) === safeString(selectedConversation.user?.id) &&
                   safeString(c.ad?.id) === safeString(selectedConversation.ad?.id)
          );
          if (index !== -1) {
            updated[index] = {
              ...updated[index],
              last_message: {
                content: messageText,
                created_at: new Date().toISOString(),
              },
            };
            // Move to top
            const [item] = updated.splice(index, 1);
            updated.unshift(item);
          }
          return updated;
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);

      let errorMessage = t("error") || "Failed to send message";
      if (error.response?.status === 401) {
        errorMessage = t("session_expired") || "Session expired. Please login again.";
      } else if (error.response?.status === 403) {
        errorMessage = t("not_authorized") || "You are not authorized to send this message";
      }

      toast.error(t("error"), { description: errorMessage });
    } finally {
      setSending(false);
    }
  }, [newMessage, selectedConversation, token, t]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
    fetchConversations(true);
  }, [fetchConversations]);

  // Go back to conversations list
  const handleBack = useCallback(() => {
    setSelectedConversation(null);
    setMessages([]);
  }, []);

  // Render loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center h-[600px]">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-16">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-zinc-950 dark:text-white mb-2">
              {t("error_loading") || "Error loading messages"}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">{error}</p>
            <Button
              onClick={handleRetry}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="retry-btn"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {t("retry") || "Retry"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render conversations list
  const renderConversations = () => {
    if (loading) {
      return (
        <div className="overflow-y-auto h-[calc(600px-60px)]">
          {[...Array(5)].map((_, index) => (
            <SkeletonConversation key={index} />
          ))}
        </div>
      );
    }

    if (!Array.isArray(conversations) || conversations.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(600px-60px)] p-4 text-center">
          <MessageCircle className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-4" />
          <p className="text-zinc-600 dark:text-zinc-400">
            {t("no_conversations") || "No conversations yet"}
          </p>
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="mt-4"
          >
            {t("browse_ads") || "Browse Ads"}
          </Button>
        </div>
      );
    }

    return (
      <div className="overflow-y-auto h-[calc(600px-60px)]">
        {conversations.map((conv, index) => {
          const userName = safeString(conv.user?.name, "Unknown");
          const adTitle = safeString(conv.ad?.title, "Ad deleted");
          const lastMessage = safeString(conv.last_message?.content, "No messages");
          const lastMessageDate = conv.last_message?.created_at;
          const isUnread = conv.unread_count > 0;

          return (
            <div
              key={index}
              onClick={() => selectConversation(conv)}
              className={`p-4 border-b border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition ${
                selectedConversation?.user?.id === conv.user?.id &&
                selectedConversation?.ad?.id === conv.ad?.id
                  ? "bg-zinc-100 dark:bg-zinc-800"
                  : ""
              }`}
              data-testid={`conversation-${index}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectConversation(conv);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    {getInitials(userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-zinc-950 dark:text-white truncate">
                      {sanitizeText(userName)}
                    </div>
                    {lastMessageDate && (
                      <div className="text-xs text-zinc-500 dark:text-zinc-500 flex-shrink-0 ml-2">
                        {formatMessageDate(lastMessageDate)}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
                    {sanitizeText(adTitle)}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-500 truncate flex items-center gap-2">
                    <span className="truncate">{sanitizeText(lastMessage)}</span>
                    {isUnread && (
                      <span className="w-2 h-2 bg-red-600 rounded-full flex-shrink-0"></span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render chat area
  const renderChat = () => {
    if (!selectedConversation) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-zinc-600 dark:text-zinc-400 p-4">
          <MessageCircle className="w-16 h-16 text-zinc-300 dark:text-zinc-600 mb-4" />
          <p className="text-center">
            {t("select_conversation") || "Select a conversation to start chatting"}
          </p>
        </div>
      );
    }

    const userName = safeString(selectedConversation.user?.name, "Unknown");
    const adTitle = safeString(selectedConversation.ad?.title, "Ad deleted");

    return (
      <>
        {/* Chat Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="lg:hidden"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-zinc-950 dark:text-white truncate">
              {sanitizeText(userName)}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
              {sanitizeText(adTitle)}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="messages-container">
          {messages.length === 0 && !loading && (
            <div className="text-center text-zinc-500 dark:text-zinc-500 py-8">
              {t("no_messages") || "No messages yet. Say hello!"}
            </div>
          )}
          {messages.map((msg) => {
            const isOwn = safeString(msg.sender_id) === safeString(user?.id);
            const content = sanitizeText(msg.content) || "Empty message";
            const timestamp = msg.created_at;

            return (
              <div
                key={msg.id || Math.random().toString()}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                data-testid={`message-${msg.id}`}
              >
                <div className="max-w-[70%]">
                  <div
                    className={`p-3 rounded-lg ${
                      isOwn
                        ? "bg-red-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white"
                    }`}
                  >
                    <div className="break-words whitespace-pre-wrap">{content}</div>
                  </div>
                  {timestamp && (
                    <div className={`text-xs mt-1 text-zinc-500 dark:text-zinc-500 ${
                      isOwn ? "text-right" : "text-left"
                    }`}>
                      {formatMessageDate(timestamp)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {sending && (
            <div className="flex justify-end">
              <div className="max-w-[70%] p-3 rounded-lg bg-red-200 dark:bg-red-800/30">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{t("sending") || "Sending..."}</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={sendMessage}
          className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
        >
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t("message") || "Type a message..."}
              className="flex-1"
              disabled={sending}
              maxLength={5000}
              data-testid="message-input"
            />
            <Button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="send-message-btn"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="messages-page">
        <h1 className="text-3xl font-black text-zinc-950 dark:text-white mb-8">
          {t("messages") || "Messages"}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          {/* Conversations List - Hidden on mobile when conversation selected */}
          <div className={`${
            selectedConversation ? "hidden lg:block" : "block"
          } lg:col-span-1 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden`}>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <h2 className="font-bold text-zinc-950 dark:text-white">
                {t("conversations") || "Conversations"}
              </h2>
            </div>
            {renderConversations()}
          </div>

          {/* Chat Area - Full width on mobile when conversation selected */}
          <div className={`${
            selectedConversation ? "block" : "hidden lg:block"
          } lg:col-span-2 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden flex flex-col`}>
            {renderChat()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;

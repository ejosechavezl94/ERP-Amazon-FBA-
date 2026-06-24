import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import {
  MessageCircle,
  Search,
  Send,
  Smile,
  SquarePen,
  User,
  Users,
  Trash2,
  Clock,
  ChevronDown
} from "lucide-react";

export default function InternalChat({ session, profile }) {
  // ** Supabase & State Management **
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Presence and states
  const [userStatus, setUserStatus] = useState(localStorage.getItem("chat_status") || "online");
  const [onlineUsers, setOnlineUsers] = useState({});
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isComposeDropdownOpen, setIsComposeDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);
  const inputRef = useRef(null);
  const currentUser = session?.user;

  // Refs for clicking outside
  const emojiPickerRef = useRef(null);
  const filterDropdownRef = useRef(null);
  const composeDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);

  // Active chat contact (defaults to first contact, or real partner)
  const [currentChatId, setCurrentChatId] = useState(null);

  const popularEmojis = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
    "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
    "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
    "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
    "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬",
    "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗",
    "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯",
    "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐",
    "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈",
    "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾",
    "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿",
    "😾", "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️",
    "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️",
    "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲",
    "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "❤️", "🧡",
    "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "🔥",
    "✨", "🌟", "⭐", "🎈", "🎉", "🎊", "💡", "💯", "🚀", "👑"
  ];

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setIsEmojiPickerOpen(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setIsFilterDropdownOpen(false);
      }
      if (composeDropdownRef.current && !composeDropdownRef.current.contains(event.target)) {
        setIsComposeDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setIsStatusDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // 1. Fetch all profiles to map user_id -> profile data
    const loadProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url");
        if (error) throw error;

        const profileMap = {};
        data.forEach((p) => {
          profileMap[p.id] = p;
        });
        setProfiles(profileMap);
      } catch (err) {
        console.error("Error loading profiles for chat:", err);
      }
    };

    // 2. Fetch recent messages
    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("internal_messages")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(100);
        if (error) throw error;
        setMessages(data);
        return data;
      } catch (err) {
        console.error("Error loading messages:", err);
        return [];
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    };

    const markMessagesAsRead = async (msgs) => {
      if (!currentUser) return;
      const unreadMsgIds = msgs
        .filter((m) => m.user_id !== currentUser.id && !m.is_read)
        .map((m) => m.id);

      if (unreadMsgIds.length === 0) return;

      try {
        const { error } = await supabase
          .from("internal_messages")
          .update({ is_read: true })
          .in("id", unreadMsgIds);

        if (error) throw error;

        // Update state locally
        setMessages((prev) =>
          prev.map((m) => (unreadMsgIds.includes(m.id) ? { ...m, is_read: true } : m))
        );
      } catch (err) {
        console.error("Error marking messages as read:", err);
      }
    };

    loadProfiles().then(loadMessages).then((loadedMsgs) => {
      if (loadedMsgs && loadedMsgs.length > 0) {
        markMessagesAsRead(loadedMsgs);
      }
    });

    // 3. Set up Supabase Realtime channel for Postgres changes & Presence
    const channel = supabase.channel("internal-chat-room", {
      config: {
        presence: {
          key: currentUser?.id || "anonymous",
        },
      },
    });

    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "internal_messages",
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              const next = [...prev, newMsg];
              if (newMsg.user_id !== currentUser?.id) {
                setTimeout(() => markMessagesAsRead([newMsg]), 100);
              }
              return next;
            });
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setMessages((prev) => prev.filter((m) => m.id !== deletedId));
          } else if (payload.eventType === "UPDATE") {
            const updatedMsg = payload.new;
            setMessages((prev) =>
              prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
            );
          }
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users = {};
        Object.keys(state).forEach((key) => {
          const trackData = state[key][0];
          if (trackData) {
            users[trackData.user_id] = trackData;
          }
        });
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUser?.id,
            status: localStorage.getItem("chat_status") || "online",
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentUser?.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleStatusChange = async (newStatus) => {
    setUserStatus(newStatus);
    localStorage.setItem("chat_status", newStatus);
    if (channelRef.current && currentUser) {
      await channelRef.current.track({
        user_id: currentUser.id,
        status: newStatus,
        online_at: new Date().toISOString(),
      });
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    const textToSend = newMessage;
    setNewMessage("");
    setSending(true);

    try {
      const { data, error } = await supabase
        .from("internal_messages")
        .insert([
          {
            user_id: currentUser.id,
            message: textToSend,
          },
        ])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data[0].id)) return prev;
          return [...prev, data[0]];
        });
      }
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Error al enviar el mensaje");
    } finally {
      setSending(false);
      scrollToBottom();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar tu mensaje?")) return;
    try {
      const { error } = await supabase
        .from("internal_messages")
        .delete()
        .eq("id", msgId);
      if (error) throw error;

      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err) {
      console.error("Error deleting message:", err);
      alert("No pudimos eliminar el mensaje");
    }
  };

  const formatMessageTime = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  };

  const formatMessageDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString([], { day: "numeric", month: "short" });
    } catch (e) {
      return "";
    }
  };

  // Build the list of contacts using only the database profiles (the partner)
  const allContacts = Object.values(profiles)
    .filter((p) => p.id !== currentUser?.id)
    .map((p) => ({
      id: p.id,
      name: p.full_name || p.email,
      email: p.email,
      image: p.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${p.full_name || p.email}`,
      isMock: false,
    }));

  // Set default chat ID on load
  useEffect(() => {
    if (allContacts.length > 0 && !currentChatId) {
      setCurrentChatId(allContacts[0].id);
    }
  }, [profiles]);

  const activeContact = allContacts.find((c) => c.id === currentChatId) || allContacts[0];

  // Get active contact status details
  const getContactStatus = (contact) => {
    if (!contact) return { status: "offline", label: "Desconectado", color: "#8a99ad" };
    if (contact.isMock) return { status: "online", label: "Activo (Demo)", color: "var(--success-color)" };
    
    const presence = onlineUsers[contact.id];
    if (presence) {
      const st = presence.status;
      return {
        status: st,
        label: st === "online" ? "Activo" : st === "away" ? "Ausente" : st === "busy" ? "Ocupado" : "Desconectado",
        color: st === "online" ? "var(--success-color)" : st === "away" ? "var(--warning-color)" : st === "busy" ? "var(--danger-color)" : "#8a99ad",
      };
    }
    return { status: "offline", label: "Desconectado", color: "#8a99ad" };
  };

  const contactStatus = getContactStatus(activeContact);

  const filteredContacts = allContacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="internal-chat-layout">
      {/* Styles local Injection */}
      <style>{`
        .internal-chat-layout {
          display: flex;
          height: calc(100vh - 120px);
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          overflow: hidden;
          font-family: var(--font-sans);
          color: var(--text-primary);
        }

        /* Custom Status Dropdown */
        .status-dropdown-container {
          position: relative;
          display: inline-block;
        }
        .status-trigger-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          cursor: pointer;
          color: var(--text-primary);
          font-size: 0.8rem;
          font-weight: 600;
          transition: all 0.2s ease;
          outline: none;
        }
        .status-trigger-btn:hover {
          background-color: var(--bg-tertiary);
          border-color: var(--accent-color);
          box-shadow: 0 0 8px rgba(99, 102, 241, 0.15);
        }
        .status-dot-pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          position: relative;
          display: inline-block;
        }
        .status-dot-pulse.online {
          background-color: #22c55e;
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
          animation: status-pulse-green 2s infinite;
        }
        .status-dot-pulse.away {
          background-color: #f59e0b;
        }
        .status-dot-pulse.busy {
          background-color: #ef4444;
          box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
          animation: status-pulse-red 2s infinite;
        }
        @keyframes status-pulse-green {
          0% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          }
          70% {
            box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
          }
        }
        @keyframes status-pulse-red {
          0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          70% {
            box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
        
        .status-menu {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 6px;
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          z-index: 100;
          padding: 6px;
          width: 150px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          animation: status-dropdown-fade 0.18s ease-out;
        }
        @keyframes status-dropdown-fade {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .status-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border: none;
          background: none;
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          width: 100%;
          text-align: left;
        }
        .status-option:hover {
          background-color: var(--bg-secondary);
          color: var(--text-primary);
        }
        .status-option.active {
          background-color: var(--accent-light);
          color: var(--accent-color);
        }

        /* Sub-sidebar Styling */
        .chat-sidebar {
          width: 220px;
          background-color: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          transition: width 0.2s;
          flex-shrink: 0;
        }
        .chat-sidebar.collapsed {
          width: 60px;
        }
        .chat-sidebar-header {
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid var(--border-color);
        }
        .chat-sidebar-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 12px 6px;
          gap: 6px;
        }
        .chat-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: none;
          border: none;
          color: var(--text-secondary);
          border-radius: var(--border-radius);
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          text-align: left;
          width: 100%;
          transition: all 0.15s;
        }
        .chat-menu-item:hover, .chat-menu-item.active {
          background-color: var(--accent-light);
          color: var(--accent-color);
        }
        .chat-sidebar-footer {
          padding: 12px 6px;
          border-top: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: relative;
        }

        /* Split view */
        .chat-main-area {
          flex: 1;
          display: flex;
          height: 100%;
        }

        /* Left Panel - Chat List */
        .chat-list-panel {
          width: 320px;
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          background-color: var(--bg-primary);
          flex-shrink: 0;
        }
        .chat-list-header {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .chat-list-title {
          font-size: 1.2rem;
          font-weight: 700;
        }
        .chat-list-actions {
          display: flex;
          gap: 4px;
        }
        .icon-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          padding: 6px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s;
        }
        .icon-btn:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
        }
        .search-container {
          padding: 0 16px 12px 16px;
          position: relative;
        }
        .search-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          color: var(--text-primary);
          font-size: 0.85rem;
          outline: none;
        }
        .search-icon {
          position: absolute;
          left: 28px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary);
        }
        .contact-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 8px;
        }
        .contact-card {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: none;
          border: none;
          border-radius: var(--border-radius);
          cursor: pointer;
          text-align: left;
          transition: background-color 0.15s;
          margin-bottom: 4px;
        }
        .contact-card:hover {
          background-color: var(--bg-secondary);
        }
        .contact-card.active {
          background-color: var(--accent-light);
        }
        .avatar-container {
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
        }
        .avatar-img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
        .status-dot {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 2px solid var(--bg-primary);
        }
        .contact-info {
          flex: 1;
          min-width: 0;
        }
        .contact-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .contact-msg {
          font-size: 0.75rem;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }

        /* Right Panel - Chat Window */
        .chat-window {
          flex: 1;
          display: flex;
          flex-direction: column;
          background-color: var(--bg-secondary);
        }
        .chat-header {
          height: 64px;
          border-bottom: 1px solid var(--border-color);
          background-color: var(--bg-primary);
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .chat-header-user {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .chat-header-actions {
          display: flex;
          gap: 8px;
        }

        /* Message feed */
        .message-feed {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .message-row {
          display: flex;
          width: 100%;
        }
        .message-row.own {
          justify-content: flex-end;
        }
        .message-bubble {
          max-width: 70%;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 0.88rem;
          line-height: 1.4;
          word-break: break-word;
          box-shadow: var(--shadow-sm);
        }
        .message-row.own .message-bubble {
          background-color: var(--accent-color);
          color: white;
          border-bottom-right-radius: 2px;
        }
        .message-row.other .message-bubble {
          background-color: var(--bg-primary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-bottom-left-radius: 2px;
        }
        .message-meta {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          margin-top: 4px;
          font-size: 0.65rem;
          color: rgba(255,255,255,0.8);
        }
        .message-row.other .message-meta {
          color: var(--text-tertiary);
        }

        /* Chat Input Area */
        .chat-input-bar {
          background-color: var(--bg-primary);
          border-top: 1px solid var(--border-color);
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .chat-input-field {
          flex: 1;
          border: none;
          background: none;
          padding: 8px 12px;
          font-size: 0.9rem;
          color: var(--text-primary);
          outline: none;
        }

        /* Dropdowns */
        .custom-dropdown-container {
          position: relative;
        }
        .custom-dropdown-menu {
          position: absolute;
          bottom: 100%;
          left: 0;
          margin-bottom: 8px;
          width: 200px;
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          box-shadow: var(--shadow-lg);
          z-index: 50;
          padding: 6px 0;
          display: flex;
          flex-direction: column;
        }
        .custom-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: none;
          border: none;
          width: 100%;
          text-align: left;
          color: var(--text-secondary);
          font-size: 0.85rem;
          cursor: pointer;
        }
        .custom-dropdown-item:hover {
          background-color: var(--bg-secondary);
          color: var(--text-primary);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Main Split View */}
      <div className="chat-main-area">
        {/* Left Panel: Chat List */}
        <div className="chat-list-panel">
          <div className="chat-list-header">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="chat-list-title">Chats</span>
              <div className="status-dropdown-container" ref={statusDropdownRef}>
                <button
                  className="status-trigger-btn"
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                >
                  <span className={`status-dot-pulse ${userStatus}`} />
                  <span>
                    {userStatus === "online" ? "Activo" : userStatus === "away" ? "Ausente" : "Ocupado"}
                  </span>
                  <ChevronDown
                    size={14}
                    style={{
                      opacity: 0.7,
                      transform: isStatusDropdownOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s"
                    }}
                  />
                </button>
                {isStatusDropdownOpen && (
                  <div className="status-menu">
                    <button
                      className={`status-option ${userStatus === "online" ? "active" : ""}`}
                      onClick={() => {
                        handleStatusChange("online");
                        setIsStatusDropdownOpen(false);
                      }}
                    >
                      <span className="status-dot-pulse online" /> Activo
                    </button>
                    <button
                      className={`status-option ${userStatus === "away" ? "active" : ""}`}
                      onClick={() => {
                        handleStatusChange("away");
                        setIsStatusDropdownOpen(false);
                      }}
                    >
                      <span className="status-dot-pulse away" /> Ausente
                    </button>
                    <button
                      className={`status-option ${userStatus === "busy" ? "active" : ""}`}
                      onClick={() => {
                        handleStatusChange("busy");
                        setIsStatusDropdownOpen(false);
                      }}
                    >
                      <span className="status-dot-pulse busy" /> Ocupado
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="chat-list-actions">
              {/* Compose Dropdown */}
              <div className="custom-dropdown-container" ref={composeDropdownRef}>
                <button className="icon-btn" onClick={() => setIsComposeDropdownOpen(!isComposeDropdownOpen)}>
                  <SquarePen size={18} />
                </button>
                {isComposeDropdownOpen && (
                  <div className="custom-dropdown-menu" style={{ left: "auto", right: "0", top: "100%", bottom: "auto", marginTop: "4px" }}>
                    <button className="custom-dropdown-item" onClick={() => { alert("Agregar Contacto"); setIsComposeDropdownOpen(false); }}>
                      <User size={14} /> Nuevo Contacto
                    </button>
                    <button className="custom-dropdown-item" onClick={() => { alert("Nuevo Grupo"); setIsComposeDropdownOpen(false); }}>
                      <Users size={14} /> Nuevo Grupo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="search-container">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Buscar o empezar chat..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Scrollable contact list */}
          <div className="contact-list">
            {filteredContacts.map((contact) => {
              const active = contact.id === currentChatId;
              const isOnline = contact.isMock || onlineUsers[contact.id]?.status === "online";
              const lastMessage = !contact.isMock
                ? messages[messages.length - 1]?.message || "Ningún mensaje aún"
                : "Mensaje de demostración de chat...";

              return (
                <button
                  key={contact.id}
                  className={`contact-card ${active ? "active" : ""}`}
                  onClick={() => {
                    setCurrentChatId(contact.id);
                    setIsFilterDropdownOpen(false);
                    setIsComposeDropdownOpen(false);
                  }}
                >
                  <div className="avatar-container">
                    <img className="avatar-img" src={contact.image} alt={contact.name} />
                    <span className="status-dot" style={{ backgroundColor: getContactStatus(contact).color }} />
                  </div>
                  <div className="contact-info">
                    <div className="contact-name">{contact.name}</div>
                    <div className="contact-msg">{lastMessage}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Chat Window */}
        <div className="chat-window">
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-user">
              <div className="avatar-container" style={{ width: "42px", height: "42px" }}>
                <img className="avatar-img" src={activeContact?.image} alt={activeContact?.name} />
                <span className="status-dot" style={{ backgroundColor: contactStatus.color }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{activeContact?.name}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {contactStatus.label} • {activeContact?.email}
                </span>
              </div>
            </div>
            <div className="chat-header-actions">
              <button className="icon-btn" onClick={() => { setIsChatSearchOpen(!isChatSearchOpen); setChatSearchQuery(""); }} title="Buscar">
                <Search size={18} />
              </button>
            </div>
          </div>

          {/* Chat Message Search Bar */}
          {isChatSearchOpen && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              backgroundColor: "var(--bg-primary)",
              borderBottom: "1px solid var(--border-color)",
              animation: "fadeIn 0.2s"
            }}>
              <Search size={14} style={{ color: "var(--text-tertiary)" }} />
              <input
                type="text"
                placeholder="Buscar mensajes en este chat..."
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  outline: "none",
                  fontSize: "0.85rem",
                  color: "var(--text-primary)"
                }}
                autoFocus
              />
              {chatSearchQuery && (
                <button
                  type="button"
                  onClick={() => setChatSearchQuery("")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-tertiary)",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    padding: "4px"
                  }}
                >
                  Limpiar
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsChatSearchOpen(false);
                  setChatSearchQuery("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "4px"
                }}
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Info bar: 7-day prune warning */}
          <div style={{
            padding: "6px 16px",
            backgroundColor: "var(--bg-tertiary)",
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}>
            <Clock size={12} style={{ color: "var(--warning-color)" }} />
            <span>Mensajería en tiempo real conectada. Los mensajes se limpian tras 7 días.</span>
          </div>

          {/* Message feed */}
          <div className="message-feed">
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                <div style={{ border: "2px solid rgba(0,0,0,0.1)", borderTop: "2px solid var(--accent-color)", borderRadius: "50%", width: "24px", height: "24px", animation: "spin 1s linear infinite" }} />
              </div>
            ) : activeContact?.isMock ? (
              // Show mock message history if it's a simulated contact
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%", justifyContent: "center", alignItems: "center", color: "var(--text-tertiary)" }}>
                <User size={32} />
                <p style={{ fontSize: "0.85rem", margin: 0 }}>Estás visualizando un contacto de simulación.</p>
                <p style={{ fontSize: "0.75rem", margin: 0 }}>Para chatear en tiempo real con tu socio, selecciona su perfil en la lista.</p>
              </div>
            ) : messages.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", color: "var(--text-tertiary)" }}>
                <MessageCircle size={32} style={{ marginBottom: "8px" }} />
                <p style={{ fontSize: "0.85rem", margin: 0 }}>Aún no hay mensajes en este canal.</p>
                <p style={{ fontSize: "0.75rem", margin: "2px 0 0 0" }}>¡Envía el primer mensaje para empezar!</p>
              </div>
            ) : (
              messages
                .filter((msg) => !chatSearchQuery.trim() || msg.message.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                .map((msg, index, filteredArr) => {
                  const isOwnMessage = msg.user_id === currentUser?.id;
                  const msgSender = profiles[msg.user_id];
                  const senderName = msgSender?.full_name || msgSender?.email || "Socio";
                  const showDateHeader =
                    index === 0 ||
                    formatMessageDate(filteredArr[index - 1].created_at) !==
                      formatMessageDate(msg.created_at);

                return (
                  <div key={msg.id} style={{ display: "flex", flexDirection: "column" }}>
                    {showDateHeader && (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "12px 0", fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
                        <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border-color)" }} />
                        <span>{formatMessageDate(msg.created_at)}</span>
                        <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border-color)" }} />
                      </div>
                    )}
                    <div className={`message-row ${isOwnMessage ? "own" : "other"}`}>
                      <div className="message-bubble">
                        {!isOwnMessage && (
                          <div style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: "4px", color: "var(--accent-color)" }}>
                            {senderName}
                          </div>
                        )}
                        <div>{msg.message}</div>
                        <div className="message-meta">
                          <span>{formatMessageTime(msg.created_at)}</span>
                          {isOwnMessage && (
                            <span 
                              style={{ 
                                marginLeft: "4px", 
                                fontSize: "0.85rem", 
                                color: msg.is_read ? "#38bdf8" : "rgba(255,255,255,0.5)", 
                                display: "inline-flex",
                                fontWeight: "bold" 
                              }}
                              title={msg.is_read ? "Leído" : "Enviado"}
                            >
                              {msg.is_read ? "✓✓" : "✓"}
                            </span>
                          )}
                          {isOwnMessage && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              style={{ background: "none", border: "none", padding: 0, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", alignItems: "center" }}
                              title="Eliminar"
                            >
                              <Trash2 size={10} style={{ marginLeft: "4px" }} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form className="chat-input-bar" onSubmit={handleSendMessage}>
            <div className="custom-dropdown-container" ref={emojiPickerRef}>
              <button type="button" className="icon-btn" onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}>
                <Smile size={18} />
              </button>
              {isEmojiPickerOpen && (
                <div className="custom-dropdown-menu" style={{
                  bottom: "100%",
                  left: "0",
                  marginBottom: "8px",
                  width: "320px",
                  height: "240px",
                  overflowY: "auto",
                  padding: "10px",
                  display: "grid",
                  gridTemplateColumns: "repeat(8, 1fr)",
                  gap: "6px",
                  userSelect: "none"
                }}>
                  {popularEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setNewMessage((prev) => prev + emoji);
                        inputRef.current?.focus();
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: "1.4rem",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background-color 0.15s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

 
            <input
              ref={inputRef}
              type="text"
              className="chat-input-field"
              placeholder="Escribe un mensaje..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={activeContact?.isMock || loading}
            />

            <button
              type="submit"
              className="icon-btn"
              style={{ color: "var(--accent-color)" }}
              disabled={!newMessage.trim() || sending || loading || activeContact?.isMock}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

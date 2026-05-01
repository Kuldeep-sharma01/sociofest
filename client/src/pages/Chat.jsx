import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import ShareModal from "@/components/ui/ShareModal";
import {
  getConversations,
  getMessages,
  searchUsers,
  sendMessage,
  markAsRead as markMessagesAsRead,
  deleteMessage,
  updateMessage,
  toggleFavorite,
  createGroup,
  updateGroup,
  removeGroupMember,
  addGroupMembers,
} from "@/services/chatService";

import { detectMediaInText } from "@/utils/textUtils";
import { useSocket } from "@/context/SocketContext";
import { useTheme } from "@/context/ThemeContext";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatWindow from "@/components/chat/ChatWindow";
import { getConnections as fetchConnections } from "@/services/connectionService";
import { getUserById } from "@/services/userService";
import UserInfo from "@/components/ui/UserInfo";
import DocumentViewer from "@/components/ui/DocumentViewer";
import {
  getWrapperThemeClasses,
  getModalBg,
  getModalHeaderBg,
  getPrimaryButtonClasses,
} from "@/utils/themeUtils";

const Chat = () => {
  const user = useSelector((state) => state.auth.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDark, appTheme } = useTheme();

  // Define URL params at the absolute top so all hooks can access them safely
  const targetUserId = searchParams.get("userId");
  const prefillText = searchParams.get("text");

  // State
  const [activeTab, setActiveTab] = useState("chats"); // 'chats' | 'network'
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);

  // Enhanced Chat State
  const [attachments, setAttachments] = useState([]);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editAttachments, setEditAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);

  // Advanced Chat State
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwardingMessages, setForwardingMessages] = useState([]);

  // Group Chat State
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState([]);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupImage, setEditGroupImage] = useState(null);
  const [previewGroupImage, setPreviewGroupImage] = useState(null);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [groupAddMembers, setGroupAddMembers] = useState([]);

  // Pagination State
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const typingTimeoutRef = useRef(null);

  // --- Block User System State ---
  const [blockedUsers, setBlockedUsers] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem(`blocked_users_${user?._id}`)) || []
      );
    } catch {
      return [];
    }
  });

  // Auto-fill composer from URL (e.g. from Marketplace inquiries)
  useEffect(() => {
    if (prefillText) {
      setNewMessage(prefillText);
      searchParams.delete("text");
      setSearchParams(searchParams, { replace: true });
    }
  }, [prefillText, searchParams, setSearchParams]);

  useEffect(() => {
    if (user?._id) {
      localStorage.setItem(
        `blocked_users_${user._id}`,
        JSON.stringify(blockedUsers),
      );
    }
  }, [blockedUsers, user?._id]);

  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const handleToggleBlock = (userId) => {
    setBlockedUsers((prev) => {
      const isBlocked = prev.includes(userId);
      const newBlocked = isBlocked
        ? prev.filter((id) => id !== userId)
        : [...prev, userId];
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: isBlocked ? "User unblocked! ✅" : "User blocked! 🚫"
        }),
      );
      return newBlocked;
    });
  };

  const attachmentsRef = useRef(attachments);
  const editAttachmentsRef = useRef(editAttachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);
  useEffect(() => {
    editAttachmentsRef.current = editAttachments;
  }, [editAttachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => {
        if (a.previewUrl?.startsWith("blob:"))
          URL.revokeObjectURL(a.previewUrl);
      });
      editAttachmentsRef.current.forEach((a) => {
        if (a.previewUrl?.startsWith("blob:"))
          URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, []);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const socket = useSocket();

  // Keep track of selectedUser in a ref to access inside fetchConvs without dependency issues
  const selectedUserRef = useRef(selectedUser);
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    if (shouldScrollToBottom) {
      if (messagesEndRef.current && chatContainerRef.current) {
        const container = chatContainerRef.current;
        const lastMsg = messagesEndRef.current.previousElementSibling;

        if (lastMsg && lastMsg.offsetHeight > container.clientHeight) {
          lastMsg.scrollIntoView({ behavior: "auto", block: "start" });
        } else {
          messagesEndRef.current.scrollIntoView({ behavior: "auto" });
        }
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }
    }
  };

  // Mark messages as read helper
  const markAsRead = async (senderId) => {
    try {
      await markMessagesAsRead(senderId);
      window.dispatchEvent(new Event("messagesRead"));
    } catch (err) {
      console.error("Failed to mark messages as read", err);
    }
  };

  // 0. Socket Connection & Listeners
  useEffect(() => {
    if (!user || !socket) return;

    // Request permission if not already granted/denied, ensuring notifications work if page loaded directly
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    const handleMessageReceived = (newMessageReceived) => {
      const isGroupMsg = conversationsRef.current.some(c => c.isGroup && String(c._id) === String(newMessageReceived.conversation));
      const convId = isGroupMsg ? newMessageReceived.conversation : newMessageReceived.sender._id;

      const isChatOpen =
        selectedUserRef.current &&
        String(selectedUserRef.current._id) === String(convId);

      // Update Conversation List (Move to top)
      setConversations((prev) => {
        const existing = prev.find((c) => String(c._id) === String(convId));
        const others = prev.filter((c) => String(c._id) !== String(convId));

        const updatedConv = existing
          ? {
              ...existing,
              lastMessage: newMessageReceived.content || "Media",
              lastMessageTime: new Date(),
              unread: isChatOpen ? 0 : (existing.unread || 0) + 1,
            }
          : {
              ...newMessageReceived.sender,
              lastMessage: newMessageReceived.content || "Media",
              lastMessageTime: new Date(),
              unread: isChatOpen ? 0 : 1,
            };
        return [updatedConv, ...others];
      });

      // Update Messages if chat is open
      if (isChatOpen) {
        setShouldScrollToBottom(true);
        setMessages((prev) => [...prev, newMessageReceived]);
        markAsRead(convId);
      } else {
        // Show notification if we are NOT chatting with this sender
        if (Notification.permission === "granted" && !user.isDnd) {
          const notification = new Notification(
            `New message from ${newMessageReceived.sender?.name || "Someone"}`,
            {
              body: newMessageReceived.content || "Sent an attachment",
              icon: newMessageReceived.sender?.profilePicture || "/vite.svg",
            },
          );
          notification.onclick = () => {
            window.focus();
            setSearchParams({ userId: convId });
          };
        }
      }
    };

    const handleTyping = (payload) => {
      const typist = typeof payload === "string" ? payload : payload.typist;
      const room = typeof payload === "string" ? payload : payload.room;
      if (selectedUserRef.current?.isGroup) {
        if (selectedUserRef.current?._id === room && typist !== user._id)
          setIsTyping(typist);
      } else {
        if (selectedUserRef.current?._id === typist) setIsTyping(true);
      }
    };
    const handleStopTyping = (payload) => {
      const typist = typeof payload === "string" ? payload : payload.typist;
      const room = typeof payload === "string" ? payload : payload.room;
      if (selectedUserRef.current?.isGroup) {
        if (selectedUserRef.current?._id === room) setIsTyping(false);
      } else {
        if (selectedUserRef.current?._id === typist) setIsTyping(false);
      }
    };

    const handleMessagesRead = ({ readerId }) => {
      if (selectedUserRef.current?._id === readerId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender._id === user._id ? { ...msg, read: true } : msg,
          ),
        );
      }
    };

    const handleMessageUpdated = (updatedMsg) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === updatedMsg._id ? { ...msg, ...updatedMsg } : msg,
        ),
      );
    };

    const handleMessageDeleted = ({ messageId, conversationId }) => {
      if (selectedUserRef.current && String(selectedUserRef.current._id) === String(conversationId)) {
        setMessages((prev) => prev.filter((m) => String(m._id) !== String(messageId)));
      }
    };

    // Explicitly pass the parameter to the handler
    socket.on("message received", handleMessageReceived);
    socket.on("message updated", handleMessageUpdated);
    socket.on("message deleted", handleMessageDeleted);

    socket.on("typing", handleTyping);
    socket.on("stop typing", handleStopTyping);
    socket.on("messages read", handleMessagesRead);

    return () => {
      socket.off("message received", handleMessageReceived);
      socket.off("message updated", handleMessageUpdated);
      socket.off("message deleted", handleMessageDeleted);
      socket.off("typing", handleTyping);
      socket.off("stop typing", handleStopTyping);
      socket.off("messages read", handleMessagesRead);
    };
  }, [user, socket, setConversations, setSearchParams]);

  // Join Group Rooms dynamically
  useEffect(() => {
    if (!socket || !conversationsLoaded) return;
    conversations.forEach((c) => {
      if (c.isGroup) {
        socket.emit("join chat", c._id);
      }
    });
  }, [conversations, conversationsLoaded, socket]);

  // Handle Window Resize for Mobile View
  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (shouldScrollToBottom) scrollToBottom();
  }, [messages, shouldScrollToBottom]);

  // Instantly clear local unread count when a user is selected
  useEffect(() => {
    if (selectedUser) {
      setConversations((prev) =>
        prev.map((c) =>
          String(c._id) === String(selectedUser._id) ? { ...c, unread: 0 } : c,
        ),
      );
    }
  }, [selectedUser]);

  // 1. Handle "Provoked" Chat (URL param) - Fixes "Pointing who is chatting to whom"
  useEffect(() => {
    if (!targetUserId) {
      setSelectedUser(null);
      return;
    }

    if (targetUserId && user && conversationsLoaded) {
      const initChat = async () => {
        try {
          // If we already have this user in our conversations, just select them
          const existingConv = conversations.find(
            (u) => String(u._id) === String(targetUserId),
          );

          if (existingConv) {
            setSelectedUser(existingConv);
            setActiveTab("chats");
          } else {
            // Otherwise fetch details and set them
            try {
              const userData = await getUserById(targetUserId);
              setSelectedUser(userData);
              // Temporarily add to conversations list so they appear in the sidebar
              setConversations((prev) => {
                if (prev.find((p) => String(p._id) === String(userData._id)))
                  return prev;
                return [userData, ...prev];
              });
              setActiveTab("chats");
            } catch (err) {
              console.warn(
                "Target user fetch failed, could be a group pending load in conversations.",
              );
            }
          }
        } catch (err) {
          console.error("Failed to load target user for chat", err);
        }
      };

      if (
        !selectedUserRef.current ||
        String(selectedUserRef.current._id) !== String(targetUserId)
      ) {
        initChat();
      }
    }
  }, [targetUserId, user, conversations, conversationsLoaded]);

  // 2. Fetch Conversations (LinkedIn "Messaging" list)
  useEffect(() => {
    let isMounted = true;
    const fetchConvs = async () => {
      try {
        const [resResult, connsResult] = await Promise.allSettled([
          getConversations(),
          fetchConnections(),
        ]);
        const serverConvs =
          resResult.status === "fulfilled" && Array.isArray(resResult.value)
            ? resResult.value
            : [];

        // Deduplicate serverConvs locally based on string ID
        const uniqueServerMap = new Map();
        serverConvs.forEach((conv) => {
          if (conv && conv._id) {
            uniqueServerMap.set(String(conv._id), conv);
          }
        });
        const dedupedServerConvs = Array.from(uniqueServerMap.values());

        // Check if connections request succeeded and has data
        const myConnections =
          connsResult.status === "fulfilled" && Array.isArray(connsResult.value)
            ? connsResult.value
            : [];

        // Filter out connections already present in active conversations to avoid duplicates
        const uniqueConnections = myConnections.filter(
          (conn) => !uniqueServerMap.has(String(conn._id)),
        );

        const mergedList = [...dedupedServerConvs, ...uniqueConnections];

        // If the currently selected user is not in the server list (new chat), manually add them
        const currentSelected = selectedUserRef.current;
        if (
          currentSelected &&
          !mergedList.some(
            (c) => c._id && String(c._id) === String(currentSelected._id),
          )
        ) {
          mergedList.unshift(currentSelected);
        }
        if (isMounted) setConversations(mergedList);
      } catch (err) {
        console.error("Failed to fetch conversations", err);
      } finally {
        if (isMounted) setConversationsLoaded(true);
      }
    };
    if (user) fetchConvs();
    return () => {
      isMounted = false;
    };
  }, [user]); // Removed 'messages' dependency to prevent aggressive refetching

  // 3. Search Users (LinkedIn "Network" list)
  useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      if (isMounted) setLoadingUsers(true);
      try {
        const res = await searchUsers("");
        if (isMounted) setUsers(res);
      } catch (err) {
        console.error("Failed to fetch users", err);
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    };
    if (user) fetchUsers();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Search users
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim() !== "") {
        setLoadingUsers(true);
        try {
          const res = await searchUsers(searchQuery);
          setUsers(res);
        } catch (error) {
          console.error("Search failed:", error);
        } finally {
          setLoadingUsers(false);
        }
      } else {
        // Reload default list if search cleared
        try {
          const res = await searchUsers("");
          setUsers(Array.isArray(res) ? res : []);
        } catch (error) {
          console.error("Search failed:", error);
        }
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Fetch messages when user selected
  useEffect(() => {
    let isMounted = true;
    const fetchChat = async () => {
      if (!selectedUser?._id) return;

      // Reset interaction states on chat switch to prevent ghosting
      setIsMultiSelectMode(false);
      setSelectedMessages([]);
      setForwardingMessages([]);
      setMenuOpenId(null);
      setReplyingToMessage(null);
      setEditingMessageId(null);

      setMessages([]);
      setLoadingMessages(true);
      setIsTyping(false);
      setHasMoreMessages(true);
      setShouldScrollToBottom(true);
      try {
        const data = await getMessages(selectedUser._id, null, 30);
        if (isMounted) {
          setMessages(data);
          setHasMoreMessages(data.length === 30);
          markAsRead(selectedUser._id);
        }
      } catch (err) {
        console.error("Failed to load messages", err);
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    };

    fetchChat();
    return () => {
      isMounted = false;
    };
  }, [selectedUser?._id]);

  // Load Older Messages (Pagination)
  const loadMoreMessages = async () => {
    if (loadingMore || !hasMoreMessages || messages.length === 0) return;
    setLoadingMore(true);
    setShouldScrollToBottom(false);
    try {
      const firstMsgId = messages[0]._id;
      const olderMessages = await getMessages(selectedUser._id, firstMsgId, 30);
      if (olderMessages.length < 30) setHasMoreMessages(false);

      const container = chatContainerRef.current;
      const previousScrollHeight = container ? container.scrollHeight : 0;

      setMessages((prev) => [...olderMessages, ...prev]);

      setTimeout(() => {
        if (container)
          container.scrollTop = container.scrollHeight - previousScrollHeight;
      }, 0);
    } catch (err) {
      console.error("Failed to load older messages", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Handle file selection
  const handleAddFiles = (newAttachments) => {
    let incoming = newAttachments;
    if (newAttachments.target) {
      incoming = Array.from(newAttachments.target.files).map((f) => ({
        file: f,
        previewUrl: URL.createObjectURL(f),
        type: f.type.startsWith("video") ? "video" : "image",
        title: f.name,
        description: "",
      }));
      newAttachments.target.value = null;
    }
    setAttachments((prev) => [...prev, ...incoming]);
  };

  const handleRemoveFile = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Typing handler
  const typingHandler = (val) => {
    setNewMessage(val);
    // Only auto-detect if no manual files are attached
    const hasManualFile = attachments.some((a) => a.file !== null);
    if (!hasManualFile) {
      const detected = detectMediaInText(val);
      if (detected) {
        let dUrl = detected.url;
        if (dUrl.includes("img.youtube.com") || dUrl.includes("i.ytimg.com")) {
          dUrl = `https://wsrv.nl/?url=${dUrl.replace(/^https?:\/\//, "")}&q=100`;
        }
        setAttachments([
          {
            previewUrl: dUrl,
            type: detected.type,
            file: null,
          },
        ]);
      } else {
        // Clear auto-detected attachment if URL is gone from text
        setAttachments((prev) => prev.filter((a) => a.file !== null));
      }
    }

    if (!socket || !selectedUser) return;

    // Emit typing to the receiver (using our own ID as the room we are typing "at" or joining their room -
    // simplified: we emit to the receiver's ID room which they joined on setup)
    // Actually logic: socket.in(receiverId).emit("typing", myId)
    // Server implementation: socket.on("typing", room => in(room).emit...)
    // So we emit to selectedUser._id
    socket.emit("typing", selectedUser._id);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (socket && selectedUser) {
        socket.emit("stop typing", selectedUser._id);
      }
    }, 3000);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && attachments.length === 0) || !selectedUser)
      return;

    setIsSending(true);
    setShouldScrollToBottom(true);
    const tempId = Date.now();

    let finalMediaUrl = attachments[0]?.previewUrl || null;
    let finalMediaType = attachments[0]?.type || null;

    // Fallback utility execution in case state hasn't updated fast enough from a paste
    if (!finalMediaUrl && attachments.length === 0) {
      const detected = detectMediaInText(newMessage);
      if (detected) {
        let dUrl = detected.url;
        if (dUrl.includes("img.youtube.com") || dUrl.includes("i.ytimg.com")) {
          dUrl = `https://wsrv.nl/?url=${dUrl.replace(/^https?:\/\//, "")}&q=100`;
        }
        finalMediaUrl = dUrl;
        finalMediaType = detected.type;
      }
    }

    const tempMsg = {
      _id: tempId,
      sender: { _id: user._id, name: user.name },
      content: newMessage,
      media: attachments.map((a) => ({
        _id: "temp_" + Math.random().toString(36).substring(7),
        path: a.previewUrl || finalMediaUrl,
        mimetype: a.type === "video" ? "video/mp4" : "image/jpeg",
        title: a.title?.trim() || "",
        description: a.description?.trim() || "",
        isDownloadable: a.isDownloadable ?? false,
      })),
      createdAt: new Date().toISOString(),
      replyToMessage: replyingToMessage
        ? {
            _id: replyingToMessage._id,
            sender: replyingToMessage.sender,
            material: replyingToMessage.material,
            senderName: replyingToMessage.sender?.name,
            content: replyingToMessage.content || replyingToMessage.material?.description,
              mediaUrl: replyingToMessage.media?.[0]?.path || replyingToMessage.mediaUrl || replyingToMessage.material?.media?.[0]?.path,
          }
        : null,
    };
    if (socket) {
      socket.emit("stop typing", selectedUser._id);
    }

    // Optimistic UI update
    setShouldScrollToBottom(true);
    setMessages((prev) => [...prev, tempMsg]);
    setConversations((prev) => {
      const existing = prev.find(
        (c) => String(c._id) === String(selectedUser._id),
      );
      const others = prev.filter(
        (c) => String(c._id) !== String(selectedUser._id),
      );
      const updatedConv = existing
        ? {
            ...existing,
            lastMessage: tempMsg.content || "Media",
            lastMessageTime: tempMsg.createdAt || new Date().toISOString(),
          }
        : {
            ...selectedUser,
            lastMessage: tempMsg.content || "Media",
            lastMessageTime: tempMsg.createdAt || new Date().toISOString(),
          };
      return [updatedConv, ...others];
    });
    setNewMessage("");
    const filesToSend = [...attachments].sort((a, b) => (a.file ? -1 : 1) - (b.file ? -1 : 1)); // Group files first to match backend indexing
    setAttachments([]);

    try {
      // Use FormData to support files
      const formData = new FormData();
      formData.append("content", tempMsg.content);
      if (replyingToMessage) {
        formData.append("replyToMessageId", replyingToMessage._id);
      }

      const actualFiles = filesToSend.filter((a) => a.file);

      const urls = [];
      const types = [];
      const titles = [];
      const descs = [];
      const downloadables = [];

      filesToSend.forEach((att) => {
        if (att.file) formData.append("files", att.file);
        else if (att.previewUrl) {
          urls.push(att.previewUrl);
          types.push(att.type || "image");
        }
        titles.push(att.title?.trim() || " ");
        descs.push(att.description?.trim() || " ");
        downloadables.push(att.isDownloadable ?? false);
      });

      if (urls.length > 0) {
        formData.append("mediaUrls", JSON.stringify(urls));
        formData.append("mediaUrls__type", "json");
        formData.append("mediaTypes", JSON.stringify(types));
        formData.append("mediaTypes__type", "json");
      }
      if (titles.length > 0) {
        formData.append("mediaTitles", JSON.stringify(titles));
        formData.append("mediaTitles__type", "json");
        formData.append("mediaDescriptions", JSON.stringify(descs));
        formData.append("mediaDescriptions__type", "json");
        formData.append("mediaDownloadable", JSON.stringify(downloadables));
        formData.append("mediaDownloadable__type", "json");
      }

      if (finalMediaUrl && filesToSend.length === 0) {
        formData.append("mediaUrl", finalMediaUrl);
        formData.append("mediaType", finalMediaType);
      }

      await sendMessage(selectedUser._id, formData);

      // Fetch to sync real ID and timestamp
      const syncedMessages = await getMessages(selectedUser._id, null, 30);
      setReplyingToMessage(null);
      setMessages(syncedMessages);
    } catch (err) {
      console.error("Failed to send message", err);
      // Revert on failure (simple version: just reload chat)
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm("Delete this message?")) return;

    // Optimistic remove
    setMessages((prev) => prev.filter((m) => m._id !== msgId));

    try {
      await deleteMessage(msgId);
    } catch (err) {
      console.error("Failed to delete", err);
      // Refresh if failed
      const freshMessages = await getMessages(selectedUser._id, null, 30);
      setMessages(freshMessages);
    }
  };

  const handlePinMessage = async (msg) => {
    const newIsPinned = !msg.isPinned;
    setMenuOpenId(null);

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) =>
        m._id === msg._id ? { ...m, isPinned: newIsPinned } : m,
      ),
    );

    try {
      await updateMessage(msg._id, { isPinned: newIsPinned });
    } catch (err) {
      console.error("Failed to pin message", err);
      // Revert on failure
      setMessages((prev) =>
        prev.map((m) =>
          m._id === msg._id ? { ...m, isPinned: msg.isPinned } : m,
        ),
      );
    }
  };

  const handleEditMessage = async (msg) => {
    setEditingMessageId(msg._id);
    setEditContent(msg.content);
    setEditAttachments(
      msg.media
        ? msg.media.map((m) => ({
            _id: m._id,
            previewUrl: m.path?.startsWith("http") ? m.path : `/${m.path}`,
            type: m.mimetype?.startsWith("video") ? "video" : "image",
            file: null,
            title: m.title,
            description: m.description,
            isDownloadable: m.isDownloadable,
          }))
        : [],
    );
    setMenuOpenId(null);
  };

  const submitEdit = async () => {
    if (!editContent.trim() && editAttachments.length === 0) return;

    const newMediaDocs = editAttachments.map((a) => ({
      _id: "temp_" + Math.random().toString(36).substring(7),
      path: a.previewUrl,
      mimetype: a.type === "video" ? "video/mp4" : "image/jpeg",
      title: a.title || "",
      description: a.description || "",
      isDownloadable: a.isDownloadable ?? false,
    }));

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) =>
        m._id === editingMessageId
          ? {
              ...m,
              content: editContent,
              isEdited: true,
              media: [...(m.media || []), ...newMediaDocs],
            }
          : m,
      ),
    );
    const idToUpdate = editingMessageId;
    const filesToSend = [...editAttachments].sort((a, b) => (a.file ? -1 : 1) - (b.file ? -1 : 1));
    setEditingMessageId(null);
    setEditAttachments([]);

    try {
      const formData = new FormData();
      formData.append("content", editContent);

       const retainedIds = filesToSend.filter((a) => a._id).map((a) => a._id);
      formData.append("retainedMediaIds", JSON.stringify(retainedIds));
      formData.append("retainedMediaIds__type", "json");

      const existingDl = filesToSend.filter((a) => a._id).map((a) => a.isDownloadable ?? false);
      formData.append("existingMediaDownloadable", JSON.stringify(existingDl));
      formData.append("existingMediaDownloadable__type", "json");

      if (filesToSend.length > 0) {
        const urls = [];
        const types = [];
        const titles = [];
        const descs = [];
        const downloadables = [];

        filesToSend.forEach((att) => {
          if (!att._id) {
            // Brand new media
            if (att.file) formData.append("files", att.file);
            else if (att.previewUrl) {
              urls.push(att.previewUrl);
              types.push(att.type || "image");
            }
            titles.push(att.title?.trim() || " ");
            descs.push(att.description?.trim() || " ");
            downloadables.push(att.isDownloadable ?? false);
          }
        });

        if (urls.length > 0) {
          formData.append("newMediaUrls", JSON.stringify(urls));
          formData.append("newMediaUrls__type", "json");
          formData.append("newMediaTypes", JSON.stringify(types));
          formData.append("newMediaTypes__type", "json");
        }
        if (titles.length > 0) {
          formData.append("mediaTitles", JSON.stringify(titles));
          formData.append("mediaTitles__type", "json");
          formData.append("mediaDescriptions", JSON.stringify(descs));
          formData.append("mediaDescriptions__type", "json");
          formData.append("mediaDownloadable", JSON.stringify(downloadables));
          formData.append("mediaDownloadable__type", "json");
        }
      }

      await updateMessage(idToUpdate, formData);

      const freshMessages = await getMessages(selectedUser._id, null, 30);
      setMessages(freshMessages);
    } catch (err) {
      console.error("Edit failed", err);
    }
  };

  const handleRemoveAttachment = async (msgId, attachmentIndex) => {
    if (!window.confirm("Remove this attachment?")) return;

    const targetMsg = messages.find((m) => m._id === msgId);
    if (!targetMsg) return;

    const newMedia = (targetMsg.media || []).filter(
      (_, i) => i !== attachmentIndex,
    );

    setMessages((prev) =>
      prev.map((m) =>
        m._id === msgId
          ? {
              ...m,
              media: newMedia,
            }
          : m,
      ),
    );

    try {
      await updateMessage(msgId, {
        retainedMediaIds: newMedia.map((m) =>
          typeof m === "string" ? m : m._id,
        ),
      });
    } catch (err) {
      console.error("Failed to remove attachment", err);
      const freshMessages = await getMessages(selectedUser._id, null, 30);
      setMessages(freshMessages);
    }
  };

  const handleCreateGroup = async () => {
    try {
      const newGroupRaw = await createGroup({
        name: newGroupName,
        participants: newGroupMembers,
      });
      const formattedGroup = {
        _id: newGroupRaw._id,
        isGroup: true,
        name: newGroupRaw.groupName || "Group Chat",
        profilePicture: null,
        role: "Group",
        department: {
          name: `${newGroupRaw.participants?.length || 0} Members`,
        },
        lastMessage: "Group created",
        lastMessageTime: new Date().toISOString(),
        unread: 0,
      };
      setShowCreateGroupModal(false);
      setNewGroupName("");
      setNewGroupMembers([]);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Group created successfully! 🚀"
        }),
      );
      setConversations((prev) => [formattedGroup, ...prev]);
      setSelectedUser(formattedGroup);
      setSearchParams({ userId: formattedGroup._id });
      setActiveTab("chats");
    } catch (err) {
      console.error("Failed to create group", err);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Failed to create group. ❌" }),
      );
    }
  };

  const handleToggleFavorite = async () => {
    if (!selectedUser) return;
    try {
      const { isFavorite: isFav } = await toggleFavorite(selectedUser._id);
      setSelectedUser((prev) => ({ ...prev, isFavorite: isFav }));
      setConversations((prev) =>
        prev.map((c) =>
          c._id === selectedUser._id ? { ...c, isFavorite: isFav } : c,
        ),
      );
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: isFav ? "Added to favorites! ⭐" : "Removed from favorites."
        }),
      );
    } catch (err) {
      console.error("Failed to toggle favorite", err);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Failed to update favorite status. ❌"
        }),
      );
    }
  };

  const handleUpdateGroup = async () => {
    if (!editGroupName.trim() && !editGroupImage) return;
    try {
      const formData = new FormData();
      if (editGroupName.trim()) formData.append("name", editGroupName);
      if (editGroupImage) formData.append("image", editGroupImage);
      const updatedGroup = await updateGroup(selectedUser._id, formData);
      setSelectedUser((prev) => ({
        ...prev,
        name: updatedGroup.groupName,
        profilePicture: updatedGroup.groupImage,
      }));
      setConversations((prev) =>
        prev.map((c) =>
          c._id === selectedUser._id
            ? {
                ...c,
                name: updatedGroup.groupName,
                profilePicture: updatedGroup.groupImage,
              }
            : c,
        ),
      );
      setIsEditingGroup(false);
      setEditGroupImage(null);
      setPreviewGroupImage(null);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Group updated successfully! ✅"
        }),
      );
    } catch (err) {
      console.error(err);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Failed to update group. ❌" }),
      );
    }
  };

  const handleRemoveGroupMember = async (memberId) => {
    if (!window.confirm("Remove this member from the group?")) return;
    try {
      const updatedGroup = await removeGroupMember(selectedUser._id, memberId);
      setSelectedUser((prev) => ({
        ...prev,
        participants: updatedGroup.participants,
        department: { name: `${updatedGroup.participants.length} Members` },
      }));
      setConversations((prev) =>
        prev.map((c) =>
          c._id === selectedUser._id
            ? { ...c, participants: updatedGroup.participants }
            : c,
        ),
      );
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Member removed. ✅" }),
      );
    } catch (err) {
      console.error(err);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Failed to remove member. ❌" }),
      );
    }
  };

  const handleAddMembersToGroup = async () => {
    try {
      const updatedGroup = await addGroupMembers(
        selectedUser._id,
        groupAddMembers,
      );
      setSelectedUser((prev) => ({
        ...prev,
        participants: updatedGroup.participants,
        department: { name: `${updatedGroup.participants.length} Members` },
      }));
      setConversations((prev) =>
        prev.map((c) =>
          c._id === selectedUser._id
            ? { ...c, participants: updatedGroup.participants }
            : c,
        ),
      );
      setGroupAddMembers([]);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Members added successfully! ✅"
        }),
      );
    } catch (err) {
      console.error(err);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Failed to add members. ❌" }),
      );
    }
  };

  const handleMultiDelete = async () => {
    if (!window.confirm(`Delete ${selectedMessages.length} messages?`)) return;
    setMessages((prev) =>
      prev.filter((m) => !selectedMessages.includes(m._id)),
    );
    try {
      await Promise.all(selectedMessages.map((msgId) => deleteMessage(msgId)));
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Messages deleted! 🗑️" }),
      );
    } catch (err) {
      const freshMessages = await getMessages(selectedUser._id, null, 30);
      setMessages(freshMessages);
    } finally {
      setIsMultiSelectMode(false);
      setSelectedMessages([]);
    }
  };

  const handleClearChat = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete all your messages in this chat?",
      )
    )
      return;
    const myMessageIds = messages
      .filter((m) => m.sender?._id === user._id)
      .map((m) => m._id);
    if (myMessageIds.length === 0) return;
    setMessages((prev) => prev.filter((m) => !myMessageIds.includes(m._id)));
    try {
      await Promise.all(myMessageIds.map((msgId) => deleteMessage(msgId)));
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Chat cleared! 🗑️" }),
      );
    } catch (err) {
      const freshMessages = await getMessages(selectedUser._id, null, 30);
      setMessages(freshMessages);
    }
  };

  const handleSingleForward = (msg) => {
    setForwardingMessages([msg]);
    setForwardModalOpen(true);
    setMenuOpenId(null);
  };

  const handleMultiForward = () => {
    const msgsToForward = messages.filter((m) =>
      selectedMessages.includes(m._id),
    );
    setForwardingMessages(msgsToForward);
    setForwardModalOpen(true);
  };

  const handleSendForward = async (targetUserId) => {
    try {
      for (const msg of forwardingMessages) {
        const formData = new FormData();
        let hasMedia = false;

        if (msg.content) formData.append("content", msg.content);

        formData.append("replyToMessageId", msg._id);

        const fetchAndAttach = async (
          url,
          type,
          title,
          desc,
          isDownloadable,
        ) => {
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Fetch failed");
            const blob = await res.blob();
            const filename =
              title || url.split("/").pop().split("?")[0] || "forwarded_file";
            const file = new File([blob], filename, {
              type: type || blob.type,
            });
            formData.append("files", file);
            formData.append("mediaTitles", title || " ");
            formData.append("mediaDescriptions", desc || " ");
            formData.append("mediaDownloadable", isDownloadable ?? false);
            hasMedia = true;
          } catch (err) {
            console.warn(
              "Could not fetch media for forwarding, using reference link",
            );
          }
        };

        if (msg.media?.length > 0) {
          for (const m of msg.media) {
            const mPath = typeof m === "string" ? m : m.path;
            await fetchAndAttach(
              mPath?.startsWith("http") ? mPath : `/${mPath}`,
              m.mimetype,
              m.title,
              m.description,
              m.isDownloadable,
            );
          }
        }

        // Fallback to reference links if physical fetch failed (e.g., cross-origin blocks)
        if (!hasMedia) {
          if (msg.media?.length > 0) {
            const urls = [];
            const types = [];
            const titles = [];
            const descs = [];
            const downloadables = [];

            msg.media.forEach((m) => {
              const mPath = typeof m === "string" ? m : m.path;
              urls.push(mPath?.startsWith("http") ? mPath : `/${mPath}`);
              types.push(m.mimetype?.startsWith("video") ? "video" : "image");
              titles.push(m.title || " ");
              descs.push(m.description || " ");
              downloadables.push(m.isDownloadable ?? false);
            });
            formData.append("mediaUrls", JSON.stringify(urls));
            formData.append("mediaUrls__type", "json");
            formData.append("mediaTypes", JSON.stringify(types));
            formData.append("mediaTypes__type", "json");
            formData.append("mediaTitles", JSON.stringify(titles));
            formData.append("mediaTitles__type", "json");
            formData.append("mediaDescriptions", JSON.stringify(descs));
            formData.append("mediaDescriptions__type", "json");
            formData.append("mediaDownloadable", JSON.stringify(downloadables));
            formData.append("mediaDownloadable__type", "json");
          }
        }

        if (
          !formData.has("content") &&
          !hasMedia &&
          !formData.has("mediaUrl") &&
          !formData.has("mediaUrls")
        )
          continue;

        await sendMessage(targetUserId, formData);
      }
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Messages forwarded successfully! 🚀"
        }),
      );
      setForwardModalOpen(false);
      setIsMultiSelectMode(false);
      setSelectedMessages([]);
      setForwardingMessages([]);
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Failed to forward messages. ❌"
        }),
      );
    }
  };

  const handleSelectUserFromNetwork = (u) => {
    setSelectedUser(u);
    setSearchParams({ userId: u._id });
    setActiveTab("chats");
    // Optimistically add to conversations to ensure they appear in the list immediately
    setConversations((prev) => {
      const filtered = prev.filter((c) => String(c._id) !== String(u._id));
      return [u, ...filtered];
    });
  };

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="loader" style={{ "--s": "25px", "--g": "5px" }}></div>
      </div>
    );
  }

  // Mobile Responsive Logic
  const showSidebar = !selectedUser || !isMobileView;
  const showChat = selectedUser || !isMobileView;

  return (
    <div
      className={`flex w-full overflow-hidden h-[calc(100dvh-64px)] ${getWrapperThemeClasses(appTheme)} ${isDark ? "dark" : ""} transition-colors `}
    >
      <ChatSidebar
        showSidebar={showSidebar}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        conversations={conversations}
        users={users}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        loadingUsers={loadingUsers}
        selectedUser={selectedUser}
        handleSelectUserFromNetwork={handleSelectUserFromNetwork}
        setSelectedUser={setSelectedUser}
        setSearchParams={setSearchParams}
        setShowCreateGroupModal={setShowCreateGroupModal}
        blockedUsers={blockedUsers}
      />
      <ChatWindow
        showChat={showChat}
        user={user}
        selectedUser={selectedUser}
        setSelectedUser={setSelectedUser}
        setSearchParams={setSearchParams}
        conversations={conversations}
        isTyping={isTyping}
        loadingMessages={loadingMessages}
        messages={messages}
        menuOpenId={menuOpenId}
        setMenuOpenId={setMenuOpenId}
        editingMessageId={editingMessageId}
        setEditingMessageId={setEditingMessageId}
        editContent={editContent}
        setEditContent={setEditContent}
        editAttachments={editAttachments}
        setEditAttachments={setEditAttachments}
        submitEdit={submitEdit}
        handleEditMessage={handleEditMessage}
        handleDeleteMessage={handleDeleteMessage}
        handlePinMessage={handlePinMessage}
        hasMoreMessages={hasMoreMessages}
        loadMoreMessages={loadMoreMessages}
        setFullscreenMedia={setFullscreenMedia}
        messagesEndRef={messagesEndRef}
        chatContainerRef={chatContainerRef}
        newMessage={newMessage}
        typingHandler={typingHandler}
        handleSendMessage={handleSendMessage}
        isSending={isSending}
        attachments={attachments}
        handleAddFiles={handleAddFiles}
        handleRemoveFile={handleRemoveFile}
        handleRemoveAttachment={handleRemoveAttachment}
        replyingToMessage={replyingToMessage}
        setReplyingToMessage={setReplyingToMessage}
        isMultiSelectMode={isMultiSelectMode}
        setIsMultiSelectMode={setIsMultiSelectMode}
        selectedMessages={selectedMessages}
        setSelectedMessages={setSelectedMessages}
        handleSingleForward={handleSingleForward}
        handleMultiForward={handleMultiForward}
        handleMultiDelete={handleMultiDelete}
        handleClearChat={handleClearChat}
        handleToggleFavorite={handleToggleFavorite}
        setShowGroupInfoModal={setShowGroupInfoModal}
        blockedUsers={blockedUsers}
        handleToggleBlock={handleToggleBlock}
        chatTheme={appTheme}
      />

      {fullscreenMedia && createPortal(
        <div className="fixed inset-0 z-[9999]">
          <DocumentViewer
            url={fullscreenMedia.url}
            title={fullscreenMedia.title || "Media"}
            media={fullscreenMedia}
            currentUser={user}
            onClose={() => setFullscreenMedia(null)}
            canEdit={false}
          />
        </div>,
        document.body
      )}

      <ShareModal
        isOpen={forwardModalOpen}
        onClose={() => setForwardModalOpen(false)}
        users={conversations}
        onShare={handleSendForward}
      />

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div
            className={`${getModalBg(appTheme)} rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] border animate-in zoom-in-95 duration-200`}
          >
            <div
              className={`p-4 border-b flex justify-between items-center ${getModalHeaderBg(appTheme)}`}
            >
              <h3 className="font-bold text-lg text-inherit">
                Create New Group
              </h3>
              <button
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setNewGroupMembers([]);
                  setNewGroupName("");
                }}
                className="p-1 opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
              <div>
                <label className="block text-sm font-bold opacity-90 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Project Team Alpha"
                  className="w-full border p-2.5 rounded-lg bg-transparent text-inherit outline-none focus:ring-2 focus:ring-current opacity-90 border-inherit"
                />
              </div>
              <div>
                <label className="block text-sm font-bold opacity-90 mb-2">
                  Select Members
                </label>
                <div className="flex flex-col gap-2 border rounded-lg p-2 max-h-60 overflow-y-auto border-inherit bg-black/5 dark:bg-white/5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {users.length === 0 && (
                    <p className="text-sm opacity-60 text-center py-2">
                      Search network to find users.
                    </p>
                  )}
                  {users.map((u) => (
                    <label
                      key={u._id}
                      className="flex items-center gap-3 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={newGroupMembers.includes(u._id)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setNewGroupMembers((prev) => [...prev, u._id]);
                          else
                            setNewGroupMembers((prev) =>
                              prev.filter((id) => id !== u._id),
                            );
                        }}
                        className="w-4 h-4 rounded text-current focus:ring-current border-inherit"
                      />
                      <div className="flex-1 text-sm font-medium">
                        {u.name}{" "}
                        <span className="text-xs opacity-60 ml-1">
                          ({u.role})
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div
              className={`p-4 border-t flex justify-between items-center ${getModalHeaderBg(appTheme)} justify-end gap-2 shrink-0`}
            >
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="px-4 py-2 text-sm font-bold opacity-80 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={!newGroupName.trim() || newGroupMembers.length === 0}
                onClick={handleCreateGroup}
                className={`px-5 py-2 text-sm font-bold rounded-lg disabled:opacity-50 transition-colors ${getPrimaryButtonClasses(appTheme)}`}
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Info Modal */}
      {showGroupInfoModal && selectedUser?.isGroup && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div
            className={`${getModalBg(appTheme)} rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] border`}
          >
            <div
              className={`p-4 border-b flex justify-between items-center ${getModalHeaderBg(appTheme)}`}
            >
              <h3 className="font-bold text-lg text-inherit">Group Info</h3>
              <button
                onClick={() => {
                  setShowGroupInfoModal(false);
                  setIsEditingGroup(false);
                  setGroupAddMembers([]);
                }}
                className="p-1 opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold opacity-70 uppercase tracking-wider">
                  Group Info
                </label>
                {isEditingGroup ? (
                  <div className="flex flex-col gap-3 bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-inherit">
                    <div className="flex items-center gap-3">
                      <div className="relative group/group-img">
                        <UserInfo
                          user={{
                            ...selectedUser,
                            profilePicture:
                              previewGroupImage || selectedUser.profilePicture,
                          }}
                          avatarSize="w-12 h-12"
                          showText={false}
                        />
                        <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                          <Edit2 className="w-4 h-4 text-white" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files[0]) {
                                setEditGroupImage(e.target.files[0]);
                                setPreviewGroupImage(
                                  URL.createObjectURL(e.target.files[0]),
                                );
                              }
                            }}
                          />
                        </label>
                      </div>
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        className="flex-1 border p-2 rounded-lg text-sm bg-transparent text-inherit outline-none focus:ring-2 focus:ring-current border-inherit"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setIsEditingGroup(false);
                          setEditGroupImage(null);
                          setPreviewGroupImage(null);
                        }}
                        className="opacity-80 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors text-sm font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdateGroup}
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-inherit">
                    <div className="flex items-center gap-3">
                      <UserInfo user={selectedUser} showText={false} />
                      <span className="font-semibold text-inherit">
                        {selectedUser.name}
                      </span>
                    </div>
              {String(user._id) === String(selectedUser.groupAdmin) && (
                      <button
                        onClick={() => {
                          setEditGroupName(selectedUser.name);
                          setIsEditingGroup(true);
                        }}
                        className="opacity-70 hover:opacity-100 p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold opacity-70 uppercase tracking-wider mb-2 block">
                  Members ({selectedUser.participants?.length || 0})
                </label>
                <div className="flex flex-col gap-2 border rounded-lg p-2 max-h-48 overflow-y-auto bg-black/5 dark:bg-white/5 border-inherit [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {selectedUser.participants?.map((p) => (
                    <div
                      key={p._id}
                      className="flex items-center justify-between p-2 bg-transparent rounded-lg shadow-sm border border-inherit"
                    >
                      <div className="flex items-center gap-2">
                        <UserInfo
                          user={p}
                          avatarSize="w-8 h-8"
                          showText={false}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">
                            {p.name} {p._id === user._id && "(You)"}
                          </span>
                          <span className="text-[10px] opacity-70">
                            {p.role}
                          </span>
                        </div>
                      </div>
                {String(p._id) === String(selectedUser.groupAdmin) ? (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-full">
                          Admin
                        </span>
                ) : String(user._id) === String(selectedUser.groupAdmin) &&
                  String(p._id) !== String(user._id) ? (
                        <button
                          onClick={() => handleRemoveGroupMember(p._id)}
                          className="text-red-500 hover:text-red-700 p-1 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                          title="Remove Member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
          {String(user._id) === String(selectedUser.groupAdmin) && (
                <div className="pt-2 border-t border-inherit">
                  <label className="text-xs font-bold opacity-70 uppercase tracking-wider mb-2 block">
                    Add New Members
                  </label>
                  <div className="flex flex-col gap-2 border rounded-lg p-2 max-h-40 overflow-y-auto border-inherit bg-black/5 dark:bg-white/5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {users
                      .filter(
                        (u) =>
                          !selectedUser.participants?.some(
                            (p) => p._id === u._id,
                          ),
                      )
                      .map((u) => (
                        <label
                          key={u._id}
                          className="flex items-center gap-3 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={groupAddMembers.includes(u._id)}
                            onChange={(e) => {
                              if (e.target.checked)
                                setGroupAddMembers((prev) => [...prev, u._id]);
                              else
                                setGroupAddMembers((prev) =>
                                  prev.filter((id) => id !== u._id),
                                );
                            }}
                            className="w-4 h-4 rounded text-current focus:ring-current border-inherit"
                          />
                          <div className="flex-1 text-sm font-medium">
                            {u.name}{" "}
                            <span className="text-xs opacity-60 ml-1">
                              ({u.role})
                            </span>
                          </div>
                        </label>
                      ))}
                    {users.filter(
                      (u) =>
                        !selectedUser.participants?.some(
                          (p) => p._id === u._id,
                        ),
                    ).length === 0 && (
                      <p className="text-xs opacity-60 text-center py-2">
                        Search network to find users to add.
                      </p>
                    )}
                  </div>
                  {groupAddMembers.length > 0 && (
                    <button
                      onClick={handleAddMembersToGroup}
                      className={`w-full mt-3 font-bold py-2 rounded-lg transition-colors text-sm shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
                    >
                      Add {groupAddMembers.length} Members
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;

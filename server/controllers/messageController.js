// controllers/messageController.js
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import {
  extractMediaFromText,
  processUpload,
  processExternalUrl,
  normalizeArr,
  deleteMediaDocs,
} from "../utils/mediaHelper.js";
import { getLinkPreview } from "../utils/metadataHelper.js";
import Material from "../models/Material.js";
import PushSubscription from "../models/PushSubscription.js";
import webpush from "../utils/webPushConfig.js";
import Media from "../models/Media.js";
import {
  ok,
  created,
  badRequest,
  notFound,
  forbidden,
  serverError,
} from "../utils/index.js";

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const { window } = new JSDOM("");
const DOMPurify = createDOMPurify(window);

const mapMessagePayload = (msg) => {
  if (!msg) return msg;
  const m = { ...msg };
  if (m.material) {
    m.content = m.material.description || "";
    m.media = m.material.media || [];
    m.linkPreview = m.material.linkPreview || null;
  }
  if (m.replyToMessage) {
    m.replyToMessage = mapMessagePayload(m.replyToMessage);
    if (m.replyToMessage.sender) {
      m.replyToMessage.senderName = m.replyToMessage.sender.name;
    }
  }
  return m;
};

/**
 * @desc    Send a message
 * @route   POST /api/messages
 * @access  Private
 */

export const toggleFavorite = async (req, res, next) => {
  try {
    const { targetId } = req.params;
    let conv = await Conversation.findById(targetId);
    if (!conv) {
      conv = await Conversation.findOne({
        participants: { $all: [req.user._id, targetId] },
        isGroup: { $ne: true },
      });
    }
    if (!conv)
      return notFound(res, "Conversation not found. Send a message first.");

    const userIdStr = req.user._id.toString();

    // ✅ Use atomic MongoDB update instead of read-modify-write
    const isFavorite = conv.favorites?.some(
      (id) => id.toString() === userIdStr,
    );

    await Conversation.findByIdAndUpdate(
      conv._id,
      isFavorite
        ? { $pull: { favorites: req.user._id } }
        : { $addToSet: { favorites: req.user._id } },
    );
    ok(res, { isFavorite: !isFavorite }, "Favorite toggled successfully.");
  } catch (err) {
    next(err);
  }
};

export const updateGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { name } = req.body;
    const group = await Conversation.findById(groupId);
    if (!group || !group.isGroup) return notFound(res, "Group not found");
    if (group.groupAdmin.toString() !== req.user._id.toString())
      return forbidden(res, "Only admin can update group");
    if (name) group.groupName = name;
    if (req.file) {
      const media = await processUpload(req.file, "profiles/groups");
      group.groupImage = `/${media.path}`;
    }
    await group.save();
    await group.populate({
      path: "participants",
      select: "name profilePicture role department isOnline lastSeen",
    });
    ok(res, group, "Group updated successfully.");
  } catch (err) {
    next(err);
  }
};

export const removeGroupMember = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { memberId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      return badRequest(res, "Invalid member ID format");
    }

    const group = await Conversation.findById(groupId);
    if (!group || !group.isGroup) return notFound(res, "Group not found");

    const isMember = group.participants.some((p) => p.toString() === memberId);
    if (!isMember) return badRequest(res, "User is not a member of this group");

    const isSelfRemoval = req.user._id.toString() === memberId;
    if (
      group.groupAdmin.toString() !== req.user._id.toString() &&
      !isSelfRemoval
    )
      return forbidden(
        res,
        "Only admin can remove members, unless you are leaving the group.",
      );
    if (group.groupAdmin.toString() === memberId)
      return badRequest(res, "Admin cannot be removed");

    group.participants = group.participants.filter(
      (p) => p.toString() !== memberId,
    );
    await group.save();

    await group.populate({
      path: "participants",
      select: "name profilePicture role department isOnline lastSeen",
    });

    ok(res, group, "Member removed successfully.");
  } catch (err) {
    next(err);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    // receiverId can come from body (old way) or params (new way)
    const receiverId = req.params.receiverId || req.body.receiverId;
    console.log("Receiver ID:", receiverId);

    if (
      !receiverId ||
      !mongoose.Types.ObjectId.isValid(receiverId.toString())
    ) {
      return badRequest(res, "Invalid Receiver ID format");
    }

    let { content } = req.body;
    content = content ? DOMPurify.sanitize(content, { ALLOWED_TAGS: [] }) : "";
    let mediaTitles = normalizeArr(req.body.mediaTitles);
    let mediaDescriptions = normalizeArr(req.body.mediaDescriptions);
    let mediaDownloadable = normalizeArr(req.body.mediaDownloadable).map(
      (v) => String(v) === "true",
    );
    let linkPreview = null;

    let mediaIds = [];
    let titleDescIndex = 0;

    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        // Fix: processUpload returns a document. Don't wrap it in a new Media() constructor to prevent ghost records.
        const media = await processUpload(file, "messages");
        media.set("title", mediaTitles[titleDescIndex] || file.originalname, {
          strict: true,
        });
        media.set("description", mediaDescriptions[titleDescIndex] || " ", {
          strict: true,
        });
        media.set("isDownloadable", mediaDownloadable[titleDescIndex] ?? true, {
          strict: true,
        });
        media.set("uploader", req.user._id, { strict: true });
        await media.save();
        mediaIds.push(media._id);
        titleDescIndex++;
      }
    }
    if (
      req.body.mediaUrl &&
      req.body.mediaUrl !== "null" &&
      req.body.mediaUrl !== "undefined"
    ) {
      const mId = await processExternalUrl(
        req.body.mediaUrl,
        req.body.mediaType || "image",
        mediaTitles[titleDescIndex],
        mediaDescriptions[titleDescIndex],
        mediaDownloadable[titleDescIndex] ?? true,
      );
      mediaIds.push(mId);
      titleDescIndex++;
    }
    if (req.body.mediaUrls) {
      const urls = normalizeArr(req.body.mediaUrls);
      const types = normalizeArr(req.body.mediaTypes);
      for (let i = 0; i < urls.length; i++) {
        const mId = await processExternalUrl(
          urls[i],
          types[i] || "image",
          mediaTitles[titleDescIndex],
          mediaDescriptions[titleDescIndex],
          mediaDownloadable[titleDescIndex] ?? true,
        );
        mediaIds.push(mId);
        titleDescIndex++;
      }
    }
    if (!req.files?.length && !req.body.mediaUrls && !req.body.mediaUrl && content) {
      const extracted = extractMediaFromText(content);
      if (extracted.mediaUrl) {
        const mId = await processExternalUrl(
          extracted.mediaUrl,
          extracted.mediaType,
          "",
          "",
          true,
        );
        mediaIds.push(mId);
      }
    }

    // 3. Always check for link metadata if text content exists
    if (content) {
      try {
        const previewPromise = getLinkPreview(content);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Preview timeout")), 4000),
        );
        linkPreview = await Promise.race([previewPromise, timeoutPromise]);
      } catch (err) {
        linkPreview = null;
      }
    }

    if ((!content && mediaIds.length === 0) || !receiverId) {
      return badRequest(res, "Content/Media and Receiver ID are required");
    }

    let materialId = null;
    if (content || mediaIds.length > 0 || linkPreview) {
      const materialDoc = await Material.create({
        author: req.user._id,
        description: content || "",
        media: mediaIds,
        linkPreview,
      });
      materialId = materialDoc._id;
    }

    // Ensure IDs are ObjectIds so DB queries match correctly
    const sendId = new mongoose.Types.ObjectId(req.user._id.toString());
    const recId = new mongoose.Types.ObjectId(receiverId.toString());

    let conversationDoc = await Conversation.findById(recId);

    if (conversationDoc && conversationDoc.isGroup) {
      const isMember = conversationDoc.participants.some(
        (p) => p.toString() === req.user._id.toString(),
      );
      if (!isMember)
        return forbidden(res, "You are not a member of this group");
    }

    if (!conversationDoc || !conversationDoc.isGroup) {
      conversationDoc = await Conversation.findOne({
        participants: { $all: [sendId, recId] },
        isGroup: { $ne: true },
      });

      if (!conversationDoc) {
        conversationDoc = await Conversation.create({
          participants: [sendId, recId],
        });
      }
    }

    const newMessage = new Message({
      sender: req.user._id,
      conversation: conversationDoc._id,
      material: materialId,
    });

    // Embed the quoted message metadata dynamically
    let replyId = req.body.replyToMessageId;
    if (!replyId && req.body.replyToMessage) {
      try {
        const parsed = typeof req.body.replyToMessage === 'string' ? JSON.parse(req.body.replyToMessage) : req.body.replyToMessage;
        replyId = parsed._id;
      } catch(e) {}
    }

    if (replyId) {
      if (!mongoose.Types.ObjectId.isValid(replyId)) {
        return badRequest(res, "Invalid replyToMessageId format");
      }
      const parentMsg = await Message.findOne({
        _id: replyId,
        conversation: conversationDoc._id, // ← scope to same conversation
        isDeleted: { $ne: true },
      });
      if (!parentMsg)
        return badRequest(
          res,
          "Replied-to message not found in this conversation",
        );
      newMessage.replyToMessage = parentMsg._id;
    }

    await newMessage.save();

    conversationDoc.lastMessage = newMessage._id;
    await conversationDoc.save();

    // Re-fetch with lean() to bypass schema strictness
    const freshMessage = await Message.findById(newMessage._id)
      .populate("sender", "name email profilePicture")
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .populate({
        path: "replyToMessage",
        populate: [
          { path: "sender", select: "name profilePicture" },
          { path: "material", populate: { path: "media", model: "Media" } },
        ],
      })
      .lean();

    const mappedMessage = mapMessagePayload(freshMessage);

    if (conversationDoc.isGroup) {
      const io = req.app.get("io");
      if (io) {
        conversationDoc.participants.forEach((p) => {
          if (p.toString() !== req.user._id.toString()) {
            io.to(p.toString()).emit("message received", mappedMessage);
          }
        });
      }

      // 🚀 Send Web Push Notification for Group
      try {
        const groupSubIds = conversationDoc.participants.filter(
          (p) => p.toString() !== req.user._id.toString(),
        );
        const subs = await PushSubscription.find({
          user: { $in: groupSubIds },
        });
        const payload = JSON.stringify({
          title: `New message in ${conversationDoc.groupName}`,
          body: "You have a new message",
          url: `/chat?userId=${conversationDoc._id}`,
          senderId: req.user._id,
        });
        for (const sub of subs) {
          await webpush.sendNotification(sub, payload)
            .then(async () => {
              await PushSubscription.findByIdAndUpdate(sub._id, { updatedAt: new Date() });
            })
            .catch(async (err) => {
              if (err.statusCode === 410 || err.statusCode === 404)
                await sub.deleteOne();
            });
        }
      } catch (pushErr) {
        console.error("Web push error:", pushErr);
      }
    } else {
      const io = req.app.get("io");
      if (io) {
        io.to(receiverId.toString()).emit("message received", mappedMessage);
      }

      // 🚀 Send Web Push Notification for Direct Message
      try {
        const subs = await PushSubscription.find({ user: receiverId });
        const payload = JSON.stringify({
          title: `New message from ${req.user.name}`,
          body: "You have a new message",
          url: `/chat?userId=${req.user._id}`,
          senderId: req.user._id,
        });
        for (const sub of subs) {
          await webpush.sendNotification(sub, payload).catch(async (err) => {
            if (err.statusCode === 410 || err.statusCode === 404)
              await sub.deleteOne();
          });
        }
      } catch (pushErr) {
        console.error("Web push error:", pushErr);
      }
    }

    created(res, mappedMessage, "Message sent successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get messages between current user and another user
 * @route   GET /api/messages/:userId
 * @access  Private
 */
export const getMessages = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { cursor, limit = 30 } = req.query;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId.toString())) {
      return badRequest(res, "Invalid User ID format");
    }

    const myId = req.user._id;
    const myObjId = new mongoose.Types.ObjectId(myId.toString());
    const userObjId = new mongoose.Types.ObjectId(userId.toString());

    let query = {};
    const possibleGroup = await Conversation.findById(userObjId);

    if (possibleGroup && possibleGroup.isGroup) {
      const isMember = possibleGroup.participants.some(
        (p) => p.toString() === req.user._id.toString(),
      );
      if (!isMember)
        return forbidden(res, "You are not a member of this group");
      query = { conversation: userObjId };
    } else {
      const conv = await Conversation.findOne({
        participants: { $all: [myObjId, userObjId] },
        isGroup: { $ne: true },
      });
      if (conv) {
        query = { conversation: conv._id };
      } else {
        return ok(res, [], "No messages found.");
      }
    }

    if (cursor) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    query.isDeleted = { $ne: true };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate("sender", "name profilePicture") // Ensure profilePicture is returned
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .populate({
        path: "replyToMessage",
        populate: [
          { path: "sender", select: "name profilePicture" },
          { path: "material", populate: { path: "media", model: "Media" } },
        ],
      })
      .lean(); // Use lean to include dynamically added fields like isPinned

    const mappedMessages = messages.reverse().map(mapMessagePayload);
    ok(res, mappedMessages, "Messages retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search users for chat
 * @route   GET /api/messages/search/users
 * @access  Private
 */
export const searchUsersForChat = async (req, res, next) => {
  try {
    const { q, page = 1 } = req.query;
    const myId = req.user._id;

    const query = {
      _id: { $ne: myId },
      ...(q && { name: { $regex: escapeRegExp(q), $options: "i" } }),
    };

    const LIMIT = 20;
    const skip = (Number(page) - 1) * LIMIT;

    const [users, total] = await Promise.all([
      User.find(query)
        .select("name email role department isOnline lastSeen profilePicture")
        .populate("department", "name")
        .skip(skip)
        .limit(LIMIT),
      User.countDocuments(query),
    ]);

    ok(
      res,
      { users, total, page: Number(page), pages: Math.ceil(total / LIMIT) },
      "Users retrieved successfully.",
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get recent conversations (LinkedIn style sidebar list)
 * @route   GET /api/messages/conversations
 * @access  Private
 */
export const getConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const userObjectId = new mongoose.Types.ObjectId(currentUserId.toString());

    // Query the Conversation collection directly (Fast)
    let conversations = await Conversation.find({
      participants: userObjectId,
      isArchived: { $ne: true }, // Hide auto-archived groups from the active sidebar
    })
      .populate({
        path: "participants",
        select: "name profilePicture role department isOnline lastSeen",
        populate: { path: "department", select: "name" },
      })
      .populate({
        path: "lastMessage",
        select: "createdAt material",
        populate: { path: "material", select: "description media" },
      })
      .sort({ updatedAt: -1 });

    // ✅ Single aggregation replaces all N countDocuments calls
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          conversation: { $in: conversations.map((c) => c._id) },
          sender: { $ne: userObjectId },
          readBy: { $ne: userObjectId },
          isDeleted: { $ne: true },
        },
      },
      { $group: { _id: "$conversation", count: { $sum: 1 } } },
    ]);
    const unreadMap = new Map(
      unreadCounts.map((u) => [u._id.toString(), u.count]),
    );

    // Transform to friendly format for frontend
    const formatted = conversations.map((conv) => {
      try {
        const unreadCount = unreadMap.get(conv._id.toString()) || 0;

        if (conv.isGroup) {
          return {
            _id: conv._id,
            isGroup: true,
            name: conv.groupName || "Group Chat",
            profilePicture: conv.groupImage || null,
            role: "Group",
            department: { name: `${conv.participants.length} Members` },
            lastMessage:
              conv.lastMessage?.material?.description ||
              (conv.lastMessage?.material?.media?.length > 0
                ? "Sent an attachment"
                : ""),
            lastMessageTime:
              conv.lastMessage?.createdAt || conv.updatedAt || new Date(0),
            unread: unreadCount,
            groupAdmin: conv.groupAdmin,
            participants: conv.participants,
            isFavorite:
              conv.favorites?.some(
                (id) => id.toString() === currentUserId.toString(),
              ) || false,
          };
        }
        let partner = conv.participants.find(
          (p) => p && p._id && p._id.toString() !== currentUserId.toString(),
        );

        // Self-chat fallback (Saved Messages)
        if (
          !partner &&
          conv.participants.length === 2 &&
          conv.participants[0]._id.toString() === currentUserId.toString()
        ) {
          partner = conv.participants[0];
        }

        if (!partner) return null;

        return {
          ...partner.toObject(),
          lastMessage:
            conv.lastMessage?.material?.description ||
            (conv.lastMessage?.material?.media?.length > 0
              ? "Sent an attachment"
              : ""),
          lastMessageTime:
            conv.lastMessage?.createdAt || conv.updatedAt || new Date(0),
          unread: unreadCount,
          isFavorite:
            conv.favorites?.some(
              (id) => id.toString() === currentUserId.toString(),
            ) || false,
        };
      } catch (err) {
        console.error("Error processing conversation item:", err);
        return null;
      }
    });
    // Deduplicate conversations to prevent sidebar duplication if the DB had old buggy data
    const validFormatted = formatted.filter(Boolean);
    const uniqueMap = new Map();
    validFormatted.forEach((conv) => {
      const idStr = conv._id.toString();
      if (!uniqueMap.has(idStr)) {
        uniqueMap.set(idStr, conv);
      } else {
        // Keep the one with the most recent message if duplicates exist
        const existing = uniqueMap.get(idStr);
        if (
          new Date(conv.lastMessageTime) > new Date(existing.lastMessageTime)
        ) {
          uniqueMap.set(idStr, conv);
        }
      }
    });

    const finalConversations = Array.from(uniqueMap.values()).sort(
      (a, b) =>
        new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0),
    );

    ok(res, finalConversations, "Conversations retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get archived conversations
 * @route   GET /api/messages/archived
 * @access  Private
 */
export const getArchivedConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const userObjectId = new mongoose.Types.ObjectId(currentUserId.toString());

    const conversations = await Conversation.find({
      participants: userObjectId,
      isArchived: true,
    })
      .populate({
        path: "participants",
        select: "name profilePicture role department isOnline lastSeen",
        populate: { path: "department", select: "name" },
      })
      .populate({
        path: "lastMessage",
        select: "createdAt material",
        populate: { path: "material", select: "description media" },
      })
      .sort({ updatedAt: -1 });

    const formatted = conversations.map((conv) => {
      if (conv.isGroup) {
        return {
          _id: conv._id,
          isGroup: true,
          name: conv.groupName || "Archived Group",
          profilePicture: conv.groupImage || null,
          role: "Group",
          department: { name: `${conv.participants.length} Members` },
          lastMessage:
            conv.lastMessage?.material?.description ||
            (conv.lastMessage?.material?.media?.length > 0
              ? "Sent an attachment"
              : ""),
          lastMessageTime:
            conv.lastMessage?.createdAt || conv.updatedAt || new Date(0),
          unread: 0,
          groupAdmin: conv.groupAdmin,
          participants: conv.participants,
          isArchived: true,
        };
      }

      let partner = conv.participants.find(
        (p) => p && p._id && p._id.toString() !== currentUserId.toString(),
      );

      // Self-chat fallback (Saved Messages)
      if (
        !partner &&
        conv.participants.length === 2 &&
        conv.participants[0]._id.toString() === currentUserId.toString()
      ) {
        partner = conv.participants[0];
      }

      return {
        ...(partner ? partner.toObject() : {}),
        _id: conv._id,
        isGroup: false,
        lastMessage:
          conv.lastMessage?.material?.description ||
          (conv.lastMessage?.material?.media?.length > 0
            ? "Sent an attachment"
            : ""),
        lastMessageTime:
          conv.lastMessage?.createdAt || conv.updatedAt || new Date(0),
        unread: 0,
        isArchived: true,
      };
    });

    ok(res, formatted, "Archived conversations retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unarchive a Group Chat
 * @route   PUT /api/messages/group/:groupId/unarchive
 * @access  Private
 */
export const unarchiveGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const group = await Conversation.findById(groupId);
    if (!group || !group.isGroup) return notFound(res, "Group not found");
    if (group.groupAdmin.toString() !== req.user._id.toString())
      return forbidden(res, "Only admin can unarchive");

    group.isArchived = false;
    await group.save();
    ok(res, group, "Group unarchived successfully.");
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get total unread message count
 * @route   GET /api/messages/unread-count
 * @access  Private
 */
export const getGlobalUnreadCount = async (req, res, next) => {
  try {
    const recId = new mongoose.Types.ObjectId(req.user._id.toString());

    // Find all conversations the user is a participant of
    const userConvs = await Conversation.find({
      participants: recId,
    }).select("_id");
    const convIds = userConvs.map((c) => c._id);

    const count = await Message.countDocuments({
      conversation: { $in: convIds },
      sender: { $ne: recId },
      readBy: { $ne: recId },
      isDeleted: { $ne: true },
    });
    ok(res, { count }, "Unread count retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a message
 * @route   DELETE /api/messages/:id
 * @access  Private
 */
export const deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message || message.isDeleted)
      return notFound(res, "Message not found");

    // Ensure only sender can delete
    if (message.sender.toString() !== req.user._id.toString()) {
      return forbidden(res, "Not authorized to delete this message");
    }

    const conv = await Conversation.findById(message.conversation);

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    // ✅ After soft delete, update the conversation's lastMessage pointer:
    if (conv && conv.lastMessage?.toString() === message._id.toString()) {
      const prevMessage = await Message.findOne({
        conversation: conv._id,
        _id: { $ne: message._id },
        isDeleted: { $ne: true },
      })
        .sort({ createdAt: -1 })
        .select("_id");

      conv.lastMessage = prevMessage?._id || null;
      await conv.save();
    }

    if (conv) {
      const io = req.app.get("io");
      if (io) {
        conv.participants.forEach((p) => {
          if (p.toString() !== req.user._id.toString()) {
            io.to(p.toString()).emit("message deleted", {
              messageId: req.params.id,
              conversationId: conv._id,
            });
          }
        });
      }
    }

    ok(res, null, "Message removed successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a message
 * @route   PUT /api/messages/:id
 * @access  Private
 */
export const updateMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message || message.isDeleted)
      return notFound(res, "Message not found");

    const conv = await Conversation.findById(message.conversation);

    // ✅ Split editing and pinning into two distinct permission checks
    const isSender = message.sender.toString() === req.user._id.toString();
    const isParticipant = conv?.participants?.some(
      (p) => p.toString() === req.user._id.toString(),
    );

    if (!isParticipant) return forbidden(res, "Not authorized");

    // Content edits: sender only
    if (req.body.content !== undefined && !isSender) {
      return forbidden(res, "Only the message sender can edit content");
    }

    // Media updates: sender only
    if (
      (req.body.retainedMediaIds !== undefined ||
        (req.files && req.files.length > 0)) &&
      !isSender
    ) {
      return forbidden(res, "Only the sender can update media");
    }

    if (req.body.isPinned !== undefined) {
      message.set("isPinned", req.body.isPinned, { strict: true });
    }

    let mat = message.material
      ? await Material.findById(message.material)
      : new Material({ author: req.user._id });

    const safeContent =
      req.body.content !== undefined
        ? DOMPurify.sanitize(req.body.content, { ALLOWED_TAGS: [] })
        : undefined;

    if (safeContent !== undefined && safeContent !== mat.description) {
      mat.description = safeContent;
      message.isEdited = true;
      if (safeContent) {
        try {
          const previewPromise = getLinkPreview(safeContent);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Preview timeout")), 4000),
          );
          mat.linkPreview = await Promise.race([
            previewPromise,
            timeoutPromise,
          ]);
        } catch (err) {
          mat.linkPreview = null;
        }
      } else {
        mat.linkPreview = null;
      }
    }

    if (
      mat &&
      (req.body.retainedMediaIds !== undefined ||
        (req.files && req.files.length > 0))
    ) {
      const retainedIds = normalizeArr(req.body.retainedMediaIds);
      const orphanedDocs = [];

      const existingMedia = await Media.find({
        _id: { $in: mat.media || [] },
      });
      for (const mDoc of existingMedia) {
        if (retainedIds.includes(mDoc._id.toString())) {
          // Kept
        } else {
          orphanedDocs.push(mDoc);
        }
      }

      await deleteMediaDocs(orphanedDocs.map((o) => o._id));

      const newMediaIds = [...retainedIds];
      let mediaTitles = normalizeArr(req.body.mediaTitles);
      let mediaDescriptions = normalizeArr(req.body.mediaDescriptions);
      let mediaDownloadable = normalizeArr(req.body.mediaDownloadable).map(
        (v) => String(v) === "true",
      );
      let titleDescIndex = 0;

      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const f = req.files[i];
          // Fix: Directly update the returned media document from processUpload
          const media = await processUpload(f, "messages");
          media.set("title", mediaTitles[titleDescIndex] || f.originalname, {
            strict: true,
          });
          media.set("description", mediaDescriptions[titleDescIndex] || " ", {
            strict: true,
          });
          media.set(
            "isDownloadable",
            mediaDownloadable[titleDescIndex] ?? true,
            { strict: true },
          );
          media.set("uploader", req.user._id, { strict: true });
          await media.save();
          newMediaIds.push(media._id);
          titleDescIndex++;
        }
      }

      if (req.body.newMediaUrls) {
        const urls = normalizeArr(req.body.newMediaUrls);
        const types = normalizeArr(req.body.newMediaTypes);
        for (let i = 0; i < urls.length; i++) {
          const mId = await processExternalUrl(
            urls[i],
            types[i] || "image",
            mediaTitles[titleDescIndex] || "",
            mediaDescriptions[titleDescIndex] || "",
            mediaDownloadable[titleDescIndex] ?? true,
          );
          newMediaIds.push(mId);
          titleDescIndex++;
        }
      }

      mat.media = newMediaIds;
    }

    if (mat) {
      await mat.save();
      message.material = mat._id;
    }
    const updatedMessage = await message.save();

    const freshMessage = await Message.findById(updatedMessage._id)
      .populate("sender", "name email profilePicture")
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .populate({
        path: "replyToMessage",
        populate: [
          { path: "sender", select: "name profilePicture" },
          { path: "material", populate: { path: "media", model: "Media" } },
        ],
      })
      .lean();

    const mappedMessage = mapMessagePayload(freshMessage);

    // Notify the other user dynamically that a message was updated (pinned/edited)
    const io = req.app.get("io");
    if (io && conv) {
      conv.participants.forEach((p) => {
        if (p.toString() !== req.user._id.toString()) {
          io.to(p.toString()).emit("message updated", mappedMessage);
        }
      });
    }

    ok(res, mappedMessage, "Message updated successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a Group Chat
 * @route   POST /api/messages/group
 * @access  Private
 */
export const createGroup = async (req, res, next) => {
  try {
    const { name, participants } = req.body;

    if (!name || !participants || participants.length < 1) {
      return badRequest(res, "Group name and members are required");
    }

    for (const id of participants) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return badRequest(res, "Invalid participant ID format");
      }
    }

    const memberIds = participants.map((id) => new mongoose.Types.ObjectId(id));
    memberIds.push(new mongoose.Types.ObjectId(req.user._id.toString())); // Add the creator

    // ✅ After building memberIds, check for an identical group before creating:
    const sorted = memberIds.map((id) => id.toString()).sort();
    const existingGroups = await Conversation.find({
      isGroup: true,
      groupAdmin: req.user._id,
      groupName: name.trim(),
    }).lean();

    for (const g of existingGroups) {
      const existingSorted = g.participants.map((id) => id.toString()).sort();
      if (JSON.stringify(existingSorted) === JSON.stringify(sorted)) {
        return badRequest(
          res,
          "A group with this name and these members already exists",
        );
      }
    }

    const newGroup = await Conversation.create({
      participants: memberIds,
      isGroup: true,
      groupName: name,
      groupAdmin: req.user._id,
    });

    await newGroup.populate({
      path: "participants",
      select: "name profilePicture role department isOnline lastSeen",
    });

    created(res, newGroup, "Group created successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add members to an existing Group Chat
 * @route   PUT /api/messages/group/:groupId/add
 * @access  Private
 */
export const addGroupMembers = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { participants } = req.body;

    if (!participants || participants.length === 0) {
      return badRequest(res, "No members provided.");
    }

    const group = await Conversation.findById(groupId);
    if (!group || !group.isGroup) {
      return notFound(res, "Group not found.");
    }

    if (group.groupAdmin.toString() !== req.user._id.toString()) {
      return forbidden(res, "Only the group admin can add members");
    }

    const newMemberIds = participants
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const existingIds = group.participants.map((p) => p.toString());
    const actuallyNew = newMemberIds.filter(
      (id) => !existingIds.includes(id.toString()),
    );

    if (actuallyNew.length === 0) {
      return badRequest(res, "Selected users are already in the group.");
    }

    group.participants.push(...actuallyNew);
    await group.save();

    await group.populate({
      path: "participants",
      select: "name profilePicture role department isOnline lastSeen",
    });

    ok(res, group, "Members added successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark messages as read
 * @route   PUT /api/messages/read
 * @access  Private
 */
export const markMessagesAsRead = async (req, res, next) => {
  try {
    const { senderId } = req.body;
    const sendObjId = new mongoose.Types.ObjectId(senderId.toString());
    const recObjId = new mongoose.Types.ObjectId(req.user._id.toString());

    let targetConvId = null;
    const possibleGroup = await Conversation.findById(sendObjId);

    if (possibleGroup && possibleGroup.isGroup) {
      const isMember = possibleGroup.participants.some(
        (p) => p.toString() === req.user._id.toString(),
      );
      if (!isMember) return forbidden(res, "Not a member of this group");
      targetConvId = possibleGroup._id;
    } else {
      const conv = await Conversation.findOne({
        participants: { $all: [sendObjId, recObjId] },
        isGroup: { $ne: true },
      });
      if (!conv) return notFound(res, "Conversation not found");
      targetConvId = conv._id;
    }

    if (targetConvId) {
      await Message.updateMany(
        {
          conversation: targetConvId,
          sender: { $ne: recObjId },
          readBy: { $ne: recObjId },
          isDeleted: { $ne: true },
        },
        { $set: { read: true }, $addToSet: { readBy: recObjId } },
      );
    }

    const io = req.app.get("io");
    if (io) {
      if (possibleGroup && possibleGroup.isGroup) {
        io.to(sendObjId.toString()).emit("messages read", {
          readerId: req.user._id,
          conversationId: targetConvId,
        });
        possibleGroup.participants.forEach((p) => {
          if (p.toString() !== req.user._id.toString())
            io.to(p.toString()).emit("messages read", {
              readerId: req.user._id,
              conversationId: targetConvId,
            });
        });
      } else {
        io.to(senderId.toString()).emit("messages read", {
          readerId: req.user._id,
          conversationId: targetConvId,
        });
      }
    }

    ok(res, null, "Messages marked as read");
  } catch (error) {
    next(error);
  }
};

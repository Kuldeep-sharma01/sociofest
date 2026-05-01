// server/controllers/postController.js
import Post from "../models/Post.js";
import User from "../models/User.js";
import Event from "../models/Event.js";
import {
  processUpload,
  extractMediaFromText,
  processExternalUrl,
  normalizeArr,
  deleteMediaDocs,
} from "../utils/mediaHelper.js";
import Material from "../models/Material.js";
import { getLinkPreview } from "../utils/metadataHelper.js";
import Media from "../models/Media.js";
import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";
import { ok, created, badRequest, notFound, forbidden, serverError } from "../utils/index.js";

const VALID_REACTIONS = new Set(["👍", "❤️", "😂", "😮", "😢", "😡", "🔥", "👏"]);

// ✅ Add this helper at the top of postController.js
const isHttpUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};



const populateComments = async (posts) => {
  const isArray = Array.isArray(posts);
  const arr = isArray ? posts : [posts];
  if (arr.length === 0) return isArray ? [] : null;

  const ids = arr.map((p) => p._id);
  const allComments = await Comment.find({
    post: { $in: ids },
    isDeleted: false,
  })
    .populate("author", "name profilePicture _id")
    .sort({ createdAt: 1 })
    .lean();

  arr.forEach((p) => {
    p.comments = allComments
      .filter((c) => String(c.post) === String(p._id))
      .map((c) => ({ ...c, user: c.author })); // Alias author to user for frontend compatibility
  });
  return isArray ? arr : arr[0];
};

/**
 * @desc    Create new content (post/lecture/notice)
 * @route   POST /api/content
 * @access  Private
 */
export const createContent = async (req, res, next) => {
  try {
    const { title, content, isNotice, subjectTag, isDownloadable } = req.body;

    // Handle media attachment if present (populated by upload middleware)
    let mediaUrls = [];
    let mediaTypes = [];
    let mediaTitles = normalizeArr(req.body.mediaTitles);
    let mediaDescriptions = normalizeArr(req.body.mediaDescriptions);
    let mediaDownloadable = normalizeArr(req.body.mediaDownloadable).map(
      (v) => String(v) === "true",
    );
    let linkPreview = null;

    let mediaIds = [];
    let titleDescIndex = 0;
    // 1. Process uploaded files
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const media = await processUpload(file, "posts");
        media.set("title", mediaTitles[titleDescIndex] || "", { strict: true });
        media.set("description", mediaDescriptions[titleDescIndex] || "", { strict: true });
        media.set("isDownloadable", mediaDownloadable[titleDescIndex] ?? true, {
          strict: true,
        });
        await media.save();
        mediaIds.push(media._id);
        titleDescIndex++;
      }
    } 
    
    // 2. Process external URLs (can be mixed with files now)
    if (req.body.mediaUrls) {
      const urls = normalizeArr(req.body.mediaUrls);
      for (const u of urls) {
        if (!isHttpUrl(u)) return badRequest(res, `Invalid URL: ${u}`);
      }
      const types = normalizeArr(req.body.mediaTypes);
      for (let i = 0; i < urls.length; i++) {
        const mId = await processExternalUrl(
          urls[i],
          types[i] || "image",
          mediaTitles[titleDescIndex],
          mediaDescriptions[titleDescIndex],
          mediaDownloadable[titleDescIndex],
        );
        mediaIds.push(mId);
        titleDescIndex++;
      }
    } else if (
      req.body.mediaUrl &&
      req.body.mediaUrl !== "null" &&
      req.body.mediaUrl !== "undefined"
    ) {
      if (!isHttpUrl(req.body.mediaUrl)) return badRequest(res, "Invalid media URL.");
      const mId = await processExternalUrl(
        req.body.mediaUrl,
        req.body.mediaType || "image",
        mediaTitles[titleDescIndex],
        mediaDescriptions[titleDescIndex],
        mediaDownloadable[titleDescIndex] ?? true,
      );
      mediaIds.push(mId);
      titleDescIndex++;
    } else if (content && mediaIds.length === 0) {
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

    // Always check for rich link previews (YouTube/OpenGraph) if text exists
    if (content) {
      try {
        const previewPromise = getLinkPreview(content);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Preview timeout")), 5000),
        );
        linkPreview = await Promise.race([previewPromise, timeoutPromise]);
      } catch (err) {
        console.warn(
          "Link preview failed or timed out, ignoring...",
          err.message,
        );
        linkPreview = null;
      }
    }

    let materialId = null;
    if (title || content || mediaIds.length > 0 || linkPreview) {
      const materialDoc = await Material.create({
        title: title || "",
        author: req.user._id,
        description: content || "",
        media: mediaIds,
        linkPreview,
      });
      materialId = materialDoc._id;
    }

    // SECURITY FIX: Prevent Students from creating official college notices via API bypass
    const validIsNotice = ["Admin", "HOD", "Teacher"].includes(req.user.role)
      ? isNotice || false
      : false;

    let post = new Post({
      author: req.user._id,
      isNotice: validIsNotice,
      material: materialId,
      subjectTag: subjectTag || "",
      subject: req.body.subjectId || null,
      isDownloadable:
        isDownloadable !== undefined
          ? isDownloadable === "true" || isDownloadable === true
          : true,
    });

    await post.save();

    // Re-fetch with lean() to bypass schema strictness and guarantee all dynamic media arrays are returned
    const freshPost = await Post.findById(post._id)
      .populate("author", "name role profilePicture _id")
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .lean();

    // Inside your createPost backend controller
    const io = req.app.get("io");
    if (io) {
      if (validIsNotice) {
        io.emit("new notice", { title: "New Notice Posted" });
      } else {
        io.emit("new post", { title: "New Post Created" });
      }
    }

    created(res, await populateComments(freshPost), "Content created successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all content items (general feed)
 * @route   GET /api/content
 * @access  Private
 */
export const getAllContent = async (req, res, next) => {
  try {
    const { cursor, limit = 10, type, subjectId } = req.query;
    // Prevent Memory Bloat
    const boundedLimit = Math.min(Number(limit) || 10, 50);

    const query = {
      isNotice: false,
      isDeleted: { $ne: true },
      ...(cursor && { _id: { $lt: cursor } }),
      ...(subjectId && { subject: subjectId }),
    };

    const contentItems = await Post.find(query)
      .populate("author", "name role profilePicture _id")
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .sort({ _id: -1 })
      .limit(boundedLimit + 1)
      .lean(); // Faster execution, less memory

const hasNextPage = contentItems.length > boundedLimit;
    if (hasNextPage) contentItems.pop();

    ok(res, {
      content: await populateComments(contentItems),
      nextCursor: hasNextPage
        ? contentItems[contentItems.length - 1]._id
        : null,
    }, "Content retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get content by specific user
 * @route   GET /api/content/user/:userId
 * @access  Private
 */
export const getContentByUser = async (req, res, next) => {
  try {
    const isSelf = req.user._id.toString() === req.params.userId;
    const query = { author: req.params.userId, isNotice: false };
    if (!isSelf) query.isDeleted = { $ne: true };

    const contentItems = await Post.find(query)
      .populate("author", "name role profilePicture _id")
      .sort({ createdAt: -1 })
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .lean();

    ok(res, await populateComments(contentItems), "Content retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single content item by ID
 * @route   GET /api/content/:id
 * @access  Private
 */
export const getContentById = async (req, res, next) => {
  try {
    const contentItem = await Post.findOne({
  _id: req.params.id,
  ...(req.user.role !== "Admin" && { isDeleted: { $ne: true } }),
}).populate("author", "name role profilePicture _id").populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      }).lean();

    if (!contentItem)
      return notFound(res, "Content not found");

    ok(res, await populateComments(contentItem), "Content retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get notice board content
 * @route   GET /api/content/notices
 * @access  Private
 */
export const getNotices = async (req, res, next) => {
  try {
    const notices = await Post.find({
      isNotice: true,
      isDeleted: { $ne: true },
    })
      .populate("author", "name role profilePicture")
      .sort({ createdAt: -1 })
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .lean();

    ok(res, await populateComments(notices), "Notices retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update content
 * @route   PUT /api/content/:id
 * @access  Private
 */
export const updateContent = async (req, res, next) => {
  try {
    const { content, title, subjectTag, isDownloadable } = req.body;
    const contentItem = await Post.findById(req.params.id).populate("material");

    if (!contentItem)
      return notFound(res, "Content not found");
// ✅ In updateContent, after fetching contentItem:
if (contentItem.author.toString() !== req.user._id.toString()) {
  if (!["Admin", "HOD"].includes(req.user.role)) {
    return forbidden(res, "Not authorized to edit this content");
  }
  // HOD scope check — can only edit posts in their own department
  if (req.user.role === "HOD") {
    const postAuthor = await User.findById(contentItem.author).select("department").lean();
    if (String(postAuthor?.department) !== String(req.user.department)) {
      return forbidden(res, "HODs can only edit content within their own department.");
    }
  }
}
    // Author check
    if (
      contentItem.author.toString() !== req.user._id.toString() &&
      !["Admin", "HOD"].includes(req.user.role)
    ) {
      return forbidden(res, "Not authorized to edit this content");
    }

    let mat = contentItem.material;
    if (title !== undefined) {
      mat.title = title;
    }
    if (content !== undefined && content !== mat.description) {
      mat.description = content;
      contentItem.isEdited = true;
      if (content) {
        try {
          const previewPromise = getLinkPreview(content);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Preview timeout")), 5000),
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

    if (req.body.isDeleted !== undefined) {
      contentItem.set(
        "isDeleted",
        req.body.isDeleted === "true" || req.body.isDeleted === true,
        { strict: true },
      );
      contentItem.markModified("isDeleted");
    }
    if (subjectTag !== undefined) {
      contentItem.subjectTag = subjectTag;
    }
    if (req.body.subjectId !== undefined) {
      contentItem.subject = req.body.subjectId;
    }
    if (isDownloadable !== undefined) {
      contentItem.isDownloadable =
        isDownloadable === "true" || isDownloadable === true;
    }

    // PURE RELATIONAL SYNC ENGINE
    if (
      req.body.retainedMediaIds !== undefined ||
      (req.files && req.files.length > 0)
    ) {
      const retainedIds = normalizeArr(req.body.retainedMediaIds);
      const existingMediaDownloadable = normalizeArr(
        req.body.existingMediaDownloadable,
      ).map((v) => String(v) === "true");
      const orphanedDocs = [];

      if (mat.media && mat.media.length > 0) {
        const existingMedia = await Media.find({ _id: { $in: mat.media } });
        for (const mDoc of existingMedia) {
          const retainIndex = retainedIds.indexOf(mDoc._id.toString());
          if (retainIndex !== -1) {
            // Kept: Update download permissions if provided
            if (existingMediaDownloadable[retainIndex] !== undefined) {
              mDoc.set(
                "isDownloadable",
                existingMediaDownloadable[retainIndex],
                { strict: true },
              );
              await mDoc.save();
            }
          } else {
            orphanedDocs.push(mDoc);
          }
        }
      }

      // Unlink physically removed files
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
          const m = await processUpload(f, "posts");
          m.set("title", mediaTitles[titleDescIndex] || "", { strict: true });
          m.set("description", mediaDescriptions[titleDescIndex] || "", {
            strict: true,
          });
          m.set("isDownloadable", mediaDownloadable[titleDescIndex] ?? true, {
            strict: true,
          });
          await m.save();
          newMediaIds.push(m._id);
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

    await mat.save();
    await contentItem.save();

    // Re-fetch with lean() to guarantee all dynamic media arrays are returned after an edit
    const freshItem = await Post.findById(contentItem._id)
      .populate("author", "name role profilePicture _id")
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .lean();

    ok(res, await populateComments(freshItem), "Content updated successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle like/unlike on a post
 * @route   POST /api/posts/:id/like
 * @access  Private
 */
export const toggleLike = async (req, res, next) => {
  try {
    const { type } = req.body; // Expecting emoji type like "❤️" or "👍"
    if (type && !VALID_REACTIONS.has(type)) {
  return badRequest(res, "Invalid reaction type.");
}
    const contentItem = await Post.findById(req.params.id);
    if (!contentItem)
      return notFound(res, "Content not found");

    const userId = req.user._id;

    // Ensure reactions array exists
    if (!contentItem.reactions) contentItem.reactions = [];

    const existingReactionIndex = contentItem.reactions.findIndex(
      (r) => r.user.toString() === userId.toString(),
    );

    if (existingReactionIndex > -1) {
      // User has already reacted
      if (contentItem.reactions[existingReactionIndex].type === type) {
        // Clicked same reaction -> Remove it (Toggle off)
        contentItem.reactions.splice(existingReactionIndex, 1);
      } else {
        // Clicked different reaction -> Update it
        contentItem.reactions[existingReactionIndex].type = type;
      }
    } else {
      // New reaction
      contentItem.reactions.push({ user: userId, type: type || "👍" });

      const io = req.app.get("io");
      if (io && contentItem.author.toString() !== userId.toString()) {
        const msg = `${req.user.name} reacted ${type || "👍"} to your content.`;
        io.to(contentItem.author.toString()).emit("notification", {
          message: msg,
        });
        await Notification.create({
          recipient: contentItem.author,
          actor: userId,
          type: "post_reaction",
          message: msg,
        });
      }
    }

    await contentItem.save();
    ok(res, {
      message: "Reaction updated",
      reactions: contentItem.reactions,
    }, "Reaction updated successfully.");
  } catch (error) {
    next(error);
  }
};

const BAD_WORDS = [
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "dick",
    "cunt",
    "slut",
    "whore",
    "bastard",
    "motherfucker",
    "damn",
    "crap",
    "pussy",
    "faggot",
  ];
const MODERATION_REGEX = new RegExp(`\\b(${BAD_WORDS.join("|")})\\b`, "gi");

const moderateText = (text) => {
  if (!text || text.length > 2000) return text;
  return text.replace(MODERATION_REGEX, (match) => "*".repeat(match.length));
};

/**
 * @desc    Add a comment to a post
 * @route   POST /api/posts/:id/comment
 * @access  Private
 */
export const addComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    const contentItem = await Post.findById(req.params.id);

    if (!contentItem)
      return notFound(res, "Content not found");

    const moderatedText = moderateText(text);

    await Comment.create({
      post: contentItem._id,
      author: req.user._id,
      text: moderatedText,
    });

    const io = req.app.get("io");
    if (io && contentItem.author.toString() !== req.user._id.toString()) {
      const msg = `${req.user.name} commented: "${moderatedText.substring(0, 30)}..."`;
      io.to(contentItem.author.toString()).emit("notification", {
        message: msg,
      });
      await Notification.create({
        recipient: contentItem.author,
        actor: req.user._id,
        type: "post_comment",
        message: msg,
      });
    }

    const comments = await Comment.find({
      post: contentItem._id,
      isDeleted: false,
    })
      .populate("author", "name profilePicture _id")
      .sort({ createdAt: 1 })
      .lean();

    created(
      res,
      {
        message: "Comment added",
        comments: comments.map((c) => ({ ...c, user: c.author })),
      },
      "Comment added successfully."
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a comment from a post
 * @route   DELETE /api/posts/:id/comment/:commentId
 * @access  Private
 */
export const deleteComment = async (req, res, next) => {
  try {
    const contentItem = await Post.findById(req.params.id);
    if (!contentItem)
      return notFound(res, "Content not found");

    const commentId = req.params.commentId;
    const comment = await Comment.findById(commentId);
    if (
      !comment ||
      comment.isDeleted ||
      String(comment.post) !== String(contentItem._id)
    ) {
      return notFound(res, "Comment not found");
    }

    // SECURITY FIX: Prevent IDOR by safely handling populated user objects
    const commentUserId = comment.author.toString();
    const isAuthor = commentUserId === req.user._id.toString();
    const isPostAuthor =
      contentItem.author.toString() === req.user._id.toString();
    const isAdmin = ["Admin", "HOD"].includes(req.user.role);

    if (!isAuthor && !isPostAuthor && !isAdmin) {
      return forbidden(res, "Not authorized to delete this comment");
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    const remainingComments = await Comment.find({
      post: contentItem._id,
      isDeleted: false,
    })
      .populate("author", "name profilePicture _id")
      .sort({ createdAt: 1 })
      .lean();

    ok(res, {
      message: "Comment deleted",
      comments: remainingComments.map((c) => ({ ...c, user: c.author })),
    }, "Comment deleted successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Edit a comment on a post
 * @route   PUT /api/posts/:id/comment/:commentId
 * @access  Private
 */
export const updateComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim())
      return badRequest(res, "Comment cannot be empty");

    const contentItem = await Post.findById(req.params.id);
    if (!contentItem)
      return notFound(res, "Content not found");

    const commentId = req.params.commentId;
    const comment = await Comment.findById(commentId);
    if (
      !comment ||
      comment.isDeleted ||
      String(comment.post) !== String(contentItem._id)
    ) {
      return notFound(res, "Comment not found");
    }

    const commentUserId = comment.author.toString();
    if (
      commentUserId !== req.user._id.toString() &&
      !["Admin", "HOD"].includes(req.user.role)
    ) {
      return forbidden(res, "Not authorized to edit this comment");
    }

    comment.text = moderateText(text);
    comment.isEdited = true;
    await comment.save();

    const remainingComments = await Comment.find({
      post: contentItem._id,
      isDeleted: false,
    })
      .populate("author", "name profilePicture _id")
      .sort({ createdAt: 1 })
      .lean();

    ok(res, {
      message: "Comment updated",
      comments: remainingComments.map((c) => ({ ...c, user: c.author })),
    }, "Comment updated successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete content
 * @route   DELETE /api/content/:id
 * @access  Private
 */
export const deleteContent = async (req, res, next) => {
  try {
    const contentItem = await Post.findById(req.params.id);
    if (!contentItem) return notFound(res, "Content not found");

    if (contentItem.author.toString() !== req.user._id.toString() &&
        !["Admin", "HOD"].includes(req.user.role)) {
      return forbidden(res, "Not authorized to delete this content");
    }

    if (contentItem.get("isDeleted") === true) {
      // ✅ Hard delete — only NOW clean up media, material, and comments
      if (contentItem.material) {
        const mat = await Material.findById(contentItem.material);
        if (mat) {
          if (mat.media?.length > 0) await deleteMediaDocs(mat.media);
          await mat.deleteOne();
        }
      }
      await Comment.deleteMany({ post: contentItem._id }); // ✅ moved here
      await contentItem.deleteOne();
      return ok(res, null, "Content permanently deleted");
    } else {
      // ✅ Soft delete — touch NOTHING except the flags
      contentItem.isDeleted = true;
      contentItem.deletedAt = new Date();
      await contentItem.save();
      const io = req.app.get("io");
      if (io && contentItem.isNotice) io.emit("remove notice");
      return ok(res, null, "Content moved to trash");
    }
  } catch (error) {
    next(error);
  }
};

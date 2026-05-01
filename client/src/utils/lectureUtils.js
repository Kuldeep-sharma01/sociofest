/**
 * Shared utility for parsing [LECTURE] prefixed posts and extracting their pipe-delimited metadata.
 */
export const parseLecturePost = (post) => {
  if (!post || !post.content) return post;
  
  const contentParts = post.content.split("\n\n");
  const metaString = contentParts[0].replace("[LECTURE]", "");
  const description = contentParts.slice(1).join("\n\n");
  const parts = metaString.split("|");
  
  let englishAttachmentUrl = parts[3] !== "none" ? parts[3] ?? "" : "";
  let hindiAttachmentUrl = parts[4] !== "none" ? parts[4] ?? "" : "";
  
  // Extreme legacy fallback for older schemas where "English/Hindi" strings were in parts[3]
  if (parts.length >= 5 && ["English", "Hindi", "Bilingual"].includes(parts[3])) {
    englishAttachmentUrl = "";
    hindiAttachmentUrl = "";
    if (parts[4] !== "none") {
      if (parts[3] === "Hindi") hindiAttachmentUrl = parts[4];
      else englishAttachmentUrl = parts[4];
    }
  }
  
  return {
    ...post,
    title: parts[0] || "Untitled",
    subjectLabel: parts[1] || "General",  // consistent field name
    views: parseInt(parts[2]) || 0,
    englishAttachmentUrl,
    hindiAttachmentUrl,
    isDownloadable: parts[5] === "true",
    description,
    likes: post.reactions?.length || 0,
  };
};
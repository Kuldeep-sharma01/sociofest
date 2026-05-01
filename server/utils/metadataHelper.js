// ✅ Validate URL is public before fetching
const isPublicUrl = (rawUrl) => {
  try {
    const u = new URL(rawUrl);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname;
    // Block localhost, RFC-1918, link-local, metadata ranges
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fc|fd)/i.test(host)) return false;
    return true;
  } catch { return false; }
};

/**
 * Extracts link metadata from text.
 * Detects YouTube for embedding and fetches Open Graph tags for other links.
 */
export const getLinkPreview = async (text) => {
  if (!text) return null;

  // Find first URL
  const urlRegex = /(https?:\/\/[^\s)\]}"']+)/;
  const match = text.match(urlRegex);
  if (!match) return null;

  const url = match[0];

  // 1. YouTube Detection
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
  );
  if (ytMatch) {
    return {
      url,
      type: "youtube",
      mediaId: ytMatch[1],
      title: "YouTube Video",
      image: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
    };
  }

  // 2. Generic Open Graph Scraping
  if (!isPublicUrl(url)) return null;

  try {
    // Basic fetch with a timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
      }
    });
    clearTimeout(timeoutId);

    // ✅ Limit response body size
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    if (contentLength > 500_000) return null; // Skip pages > 500KB

    const reader = response.body.getReader();
    let html = "";
    while (html.length < 100_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
    }
    await reader.cancel().catch(() => {});

    // Simple regex parsing for OG tags
    const getMeta = (prop) => {
      const regex1 = new RegExp(`<meta[^>]+(?:property|name)="(?:og:|twitter:)?${prop}"[^>]+content="([^"]+)"`, "i");
      const regex2 = new RegExp(`<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="(?:og:|twitter:)?${prop}"`, "i");
      const m = html.match(regex1) || html.match(regex2);
      return m ? m[1] : null;
    };

    const title =
      getMeta("title") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || new URL(url).hostname;
    const description = getMeta("description");
    const image = getMeta("image");
    const siteName = getMeta("site_name") || new URL(url).hostname;

    if (title) {
      // ✅ Validate the OG image URL before including it in the response
      const safeImage = image && isPublicUrl(image) ? image : '';
      return { url, title, description: description || '', image: safeImage, siteName, type: 'link' };
    }
  } catch (err) {
    // Ignore fetching errors, treat as plain text
    // console.log("Metadata fetch failed", err.message);
  }

  return null;
};

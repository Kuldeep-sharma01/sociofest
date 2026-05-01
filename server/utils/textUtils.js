import React from "react";

export const renderContentWithLinks = (text) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
};

export const detectMediaInText = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  if (!matches) return null;
  for (const url of matches) {
    if (/\.(jpeg|jpg|gif|png|webp|bmp|svg)(\?.*)?$/i.test(url))
      return { url, type: "image" };
    if (/\.(mp4|webm|ogg|mov|mkv)(\?.*)?$/i.test(url))
      return { url, type: "video" };
  }
  return null;
};

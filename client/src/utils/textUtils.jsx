// utils/textUtils.jsx
import React, { useRef, useEffect } from "react";

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
        className="text-blue-600 hover:opacity-80 hover:no-underline transition-opacity break-all"
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

export const HIGHLIGHT_STYLES = {
  yellow: {
    name: "Classic Yellow",
    classes: "bg-yellow-300 text-indigo-900 rounded-md shadow-sm",
  },
  greenBorder: {
    name: "Green Outline",
    classes:
      "bg-transparent text-green-700 border-2 border-green-500 rounded-md",
  },
  blueUnderline: {
    name: "Blue Underline",
    classes:
      "bg-transparent text-blue-700 underline decoration-blue-500 decoration-[3px] underline-offset-2 rounded-md",
  },
  subtle: {
    name: "Subtle Gray",
    classes: "bg-gray-200 text-gray-800 rounded-md",
  },
  neon: {
    name: "Neon Purple",
    classes:
      "bg-purple-500 text-white rounded-md shadow-[0_0_10px_rgba(168,85,247,0.8)]",
  },
  redHighlight: {
    name: "Soft Red",
    classes: "bg-red-200 text-red-900 rounded-md shadow-sm",
  },
  pinkGlow: {
    name: "Pink Glow",
    classes:
      "bg-pink-100 text-pink-700 shadow-[0_0_10px_rgba(219,39,119,0.5)] rounded-md",
  },
  tealText: {
    name: "Teal Bold",
    classes: "bg-transparent text-teal-600 font-black tracking-wide rounded-md",
  },
  invert: {
    name: "High Contrast",
    classes: "bg-gray-900 text-white rounded-md shadow-md",
  },
  dashedUnderline: {
    name: "Orange Dashed",
    classes:
      "bg-transparent text-orange-700 underline decoration-dashed decoration-orange-500 decoration-[3px] underline-offset-4 rounded-md",
  },
};

export const HighlightedText = ({
  text,
  charIndex,
  charLength,
  customClass,
  speedClass = "duration-300",
  textSizeClass = "text-base",
}) => {
  const highlightRef = useRef(null);

  useEffect(() => {
    if (highlightRef.current) {
      const rect = highlightRef.current.getBoundingClientRect();
      const thresholdTop = 100;
      const thresholdBottom = window.innerHeight * 0.8;
      if (rect.top > thresholdBottom || rect.top < thresholdTop) {
        highlightRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [charIndex]);

  if (charLength === 0)
    return (
      <span className={`whitespace-pre-wrap ${textSizeClass}`}>{text}</span>
    );
  const before = text.slice(0, charIndex);
  const highlighted = text.slice(charIndex, charIndex + charLength);
  const after = text.slice(charIndex + charLength);

  return (
    <span className={`whitespace-pre-wrap ${textSizeClass}`}>
      {before}
      <span
        ref={highlightRef}
        className={`${customClass || HIGHLIGHT_STYLES.yellow.classes} font-bold transition-all ${speedClass} p-[2px]`}
      >
        {highlighted}
      </span>
      {after}
    </span>
  );
};

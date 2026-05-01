

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        wiggle: {
          "0%": {
            transform: "rotate(0deg) translateY(0)",
          },
          "100%": {
            opacity: 0.7,
            transform: "rotate(-90deg) translateY(-90px) translateX(200px)",
          },
          
          // "100%": {
          //   opacity:0,
          //   transform: "rotate(-180deg) translateY(-100px) translateX(1300px)",
          // },
        },
      },
      animation: {
        wiggle: "wiggle .5s cubic-bezier(0.4, 0, 0.2, 1)",
      },

      colors: {
        primary: "#1E40AF", // Custom blue
        secondary: "#F59E0B", // Custom amber
        dark: "#111827",
      },
      fontFamily: {
        sans: ["Helvetica", "Inter", "sans-serif", "Calibri"],
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),
  ],
};

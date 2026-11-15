/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#4E65F6", dark: "#3B4FE0", light: "#CBE4FF" },
        ocean: { DEFAULT: "#5B5CE6", light: "#CBE4FF" },
        mint: { DEFAULT: "#4E65F6", light: "#CBE4FF" },
        sun: { DEFAULT: "#D9FA64", light: "#F4FCDD" },
        coral: { DEFAULT: "#5B5CE6", light: "#CBE4FF" },
        blush: { DEFAULT: "#CBE4FF", light: "#EAF3FF" },
        teal: { DEFAULT: "#4E65F6", light: "#CBE4FF" },
        lime: { DEFAULT: "#D9FA64", light: "#F4FCDD" },
        ink: { DEFAULT: "#141928", soft: "#2F3648", muted: "#64748B" },
        canvas: "#F5F7FA",
        success: "#4E65F6",
        warning: "#5B5CE6",
        danger: "#141928",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "22px",
        "3xl": "28px",
        "4xl": "34px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20, 25, 40, 0.04), 0 12px 30px -16px rgba(20, 25, 40, 0.16)",
        lift: "0 2px 6px rgba(20, 25, 40, 0.05), 0 26px 52px -22px rgba(20, 25, 40, 0.24)",
        float: "0 18px 40px -20px rgba(20, 25, 40, 0.28), 0 2px 8px rgba(20, 25, 40, 0.06)",
        ring: "0 0 0 4px rgba(78, 101, 246, 0.16)",
        inset: "inset 0 1px 0 rgba(255, 255, 255, 0.65)",
      },
      backgroundImage: {
        brand: "linear-gradient(135deg, #4E65F6 0%, #5B5CE6 58%, #4E65F6 100%)",
        "brand-warm": "linear-gradient(120deg, #4E65F6 0%, #5B5CE6 48%, #D9FA64 100%)",
        aurora:
          "radial-gradient(circle at 10% 6%, rgba(78,101,246,0.42) 0%, transparent 48%), radial-gradient(circle at 88% 10%, rgba(203,228,255,0.22) 0%, transparent 46%), radial-gradient(circle at 62% 98%, rgba(217,250,100,0.18) 0%, transparent 54%)",
        "brand-soft": "linear-gradient(135deg, rgba(91,71,224,0.10) 0%, rgba(61,130,246,0.10) 100%)",
        mesh: "radial-gradient(circle at 15% 10%, #5B5CE6 0%, transparent 55%), radial-gradient(circle at 88% 82%, #CBE4FF 0%, transparent 58%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        "slide-in": "slide-in 0.25s ease-out both",
        "pop-in": "pop-in 0.18s ease-out both",
      },
    },
  },
  plugins: [],
};

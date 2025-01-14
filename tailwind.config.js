/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "fb-red": "#ff3e3e",
        "fb-yellow": "#ffd700",
        "fb-navy": "#1a1b4b",
        "fb-white": "#ffffff",
        "fb-black": "#000000",
        "fb-gray": "#4a4a4a",
      },
    },
  },
  plugins: [],
};

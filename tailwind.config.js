/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  // 只扫描 src 目录，避免把 LeetCode 页面本身的 class 也纳入生成范围
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {}
  },
  plugins: []
}

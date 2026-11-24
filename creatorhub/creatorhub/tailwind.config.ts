import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("bg"), surface: c("surface"), raised: c("raised"), line: c("line"),
        ink: c("ink"), muted: c("muted"), accent: c("accent"),
        ok: c("ok"), warn: c("warn"), err: c("err"), info: c("info"), sched: c("sched"),
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { rise: "rise .35s ease-out both" },
    },
  },
  plugins: [],
};
export default config;

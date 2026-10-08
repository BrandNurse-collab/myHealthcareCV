import type { Config } from "tailwindcss";

// Design tokens for myHealthcareCV. Deliberately not the "SaaS default" palette:
// a clinical ink/navy anchor, a cool neutral paper (not warm cream), and a
// single amber signal color reserved for primary actions and match scores.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14181F",
        paper: "#F4F5F1",
        navy: {
          DEFAULT: "#1F3A5F",
          dark: "#152A47",
          light: "#31527F",
        },
        verdant: {
          DEFAULT: "#3C6E58",
          light: "#EAF2ED",
        },
        amber: {
          DEFAULT: "#C97A2B",
          dark: "#A6621E",
        },
        line: "#D8DAD4",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-worksans)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        prose: "42rem",
      },
    },
  },
  plugins: [],
};

export default config;

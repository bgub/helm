import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [
    starlight({
      title: "crag",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/bgub/crag",
        },
      ],
      customCss: ["./src/styles/global.css"],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", slug: "getting-started/introduction" },
            { label: "Installation", slug: "getting-started/installation" },
            { label: "Quick Start", slug: "getting-started/quick-start" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Core Concepts", slug: "guides/core-concepts" },
            { label: "Permissions", slug: "guides/permissions" },
            { label: "Custom Skills", slug: "guides/custom-skills" },
            { label: "Search", slug: "guides/search" },
          ],
        },
        {
          label: "Skills",
          items: [
            { label: "fs", slug: "skills/fs" },
            { label: "git", slug: "skills/git" },
            { label: "grep", slug: "skills/grep" },
            { label: "edit", slug: "skills/edit" },
            { label: "shell", slug: "skills/shell" },
            { label: "http", slug: "skills/http" },
          ],
        },
        {
          label: "Reference",
          items: [{ label: "API", slug: "reference/api" }],
        },
      ],
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});

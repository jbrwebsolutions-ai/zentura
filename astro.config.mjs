// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://zentura.nl',
  trailingSlash: 'always',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});

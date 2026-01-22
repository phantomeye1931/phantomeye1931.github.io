// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// https://astro.build/config
export default defineConfig({
	site: 'https://phantomeye1931.github.io',
	base: '/',
	integrations: [mdx(), sitemap()],
	vite: {
		plugins: [
			wasm(),
			topLevelAwait(),
		]
	}
});


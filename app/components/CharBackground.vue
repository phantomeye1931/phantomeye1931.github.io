<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { genNoiseGrid } from "~/utils/noise";

const thisElement = ref<HTMLElement | null>(null);
const preElement = ref<HTMLElement | null>(null);

const props = defineProps({
  fontSizePx: { type: Number, default: 20 },
  opacity: { type: Number, default: 1 },
});

const CHARS = ' .:-=+*#%@';
const PADDING = 1;
const MARGINS: [number, number] = [2, 1];

let width = 0;
let height = 0;

let lastIndex = MARGINS[0];
function addButton(button: AsciiUIElement) {
  if (!preElement.value) return;

  const textNode = Array.from(preElement.value.childNodes).find(
      (n) => n.nodeType === Node.TEXT_NODE
  ) as Text | undefined;

  if (!textNode) return;

  const index = (MARGINS[1] + 1) * width - button.label.length - lastIndex - PADDING + 1;
  lastIndex += button.label.length + PADDING;

  const before = textNode.wholeText.slice(0, index)
  const after = textNode.wholeText.slice(index + button.label.length);

  const a = document.createElement("a");
      a.textContent = button.label;
      a.href = button.url;
      a.target = "_blank";
      a.className = "link";
      if (button.onClick) a.onclick = (event) => {
        console.log('click')
        event.preventDefault();
        button.onClick?.(event);
      };

  const replacement = document.createDocumentFragment();
  replacement.append(document.createTextNode(before), a, document.createTextNode(after));

  preElement.value.replaceChild(replacement, textNode);
}

const uiElements: AsciiUIElement[] = [
  { alignRight: true, label: '[BLOG]', url: '/blog'},
  { alignRight: true, label: '[PROJECTS]',  url: '/projects'},
  { alignRight: true, label: '[ART]',  url: '/art'},
  { alignRight: true, label: '[◑]',  url: '#', onClick: toggleDarkMode},
]

function addAllButtons() {
  for (const el of uiElements.toReversed()) addButton(el);
  lastIndex = MARGINS[0];
}

function measureCharWidth(height: number): number {
  const span = document.createElement('span');
  span.classList.add("font-trypewriter");

  span.textContent = 'M';
  span.style.position = 'absolute';
  span.style.visibility = 'hidden';
  span.style.fontSize = height + 'px';
  span.style.lineHeight = '1';

  document.body.appendChild(span);
  const rect = span.getBoundingClientRect();
  document.body.removeChild(span);

  return rect.width;
}


function makeGrid(time: number): string {
  const numericGrid = genNoiseGrid(height, width, time);

  let out = '';
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const value = numericGrid?.[r]?.[c] ?? 0;
      const charIndex = Math.floor(value * (CHARS.length - 1));
      out += CHARS[Math.max(0, Math.min(CHARS.length - 1, charIndex))];
    }
    if (r < height - 1) out += '\n';
  }

  return out;
}

function setDimensions() {
  if (!thisElement.value) return;

  const charHeight = props.fontSizePx;
  const charWidth = measureCharWidth(props.fontSizePx);

  const rect = thisElement.value.getBoundingClientRect();
  width  = Math.floor(rect.width / charWidth);
  height = Math.floor(rect.height / charHeight);
}

function refreshCharacters() {
  if (!preElement.value || !thisElement.value) return;

  setDimensions();

  preElement.value.textContent = makeGrid(Date.now() / 1000);
  addAllButtons();
}

onMounted(() => {
  refreshCharacters();
  setInterval(refreshCharacters, 125);
});

// Dark/light mode
if (window) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
}

function toggleDarkMode() {
  const current = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
}
</script>

<template>
  <div class="bg-grid" aria-hidden="true" ref="thisElement">
    <pre class="font-trypewriter" ref="preElement">test</pre>
  </div>
</template>

<style>
.bg-grid {
  position: absolute;
  width: 100%;
  z-index: 0;

  inset: 0;
  user-select: none;
  background-color: var(--col-background);
}

.bg-grid pre {
  margin: 0;
  font-size: v-bind('props.fontSizePx + "px"');

  line-height: 1;
  display: block;

  min-height: 100%;
  letter-spacing: 0;
  color: var(--col-element);
  opacity: v-bind('props.opacity');
  white-space: pre;
}

a.link {
  all: unset;
  cursor: pointer;
  text-decoration: none;
}
</style>

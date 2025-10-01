<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { genNoiseGrid } from "~/utils/noise";

const props = defineProps<{
  showButtons?: boolean,
}>();

const thisElement = ref<HTMLElement | null>(null);
const asciiGrid = ref<HTMLElement | null>(null);
const buttonGrid = ref<HTMLElement | null>(null);

const fontSize = ref(0); // Set in setDimensions()
const fontSizePx = computed(() => fontSize.value + 'px');

let width = 0;
let height = 0;

const { $toggleDarkMode } = useNuxtApp();

const uiElements: AsciiUIElement[] = [
  { alignRight: true, label: '</>', url: 'https://github.com/phantomeye1931/phantomeye1931.github.io'},
  { alignRight: true, label: 'WEBLOG', url: '/weblog'},
  { alignRight: true, label: 'PROJECTS',  url: '/projects'},
  { alignRight: true, label: 'ART',  url: '/art'},
  { alignRight: true, label: 'D',  url: '#', onClick: $toggleDarkMode},
]

let verticalLayout = () => window ? (window.innerWidth < 1000) : 0;

const MARGINS: [number, number] = [4, 1];
const PADDING = 1;

function addAllButtons() {
  if (!buttonGrid?.value) return;
  buttonGrid.value.textContent = "";

  const useVertical = verticalLayout();

  const uiWidth = uiElements.map(e => e.label).join(".".repeat(PADDING + 2)).length + MARGINS[0];

  // Initial offset
  buttonGrid.value.appendChild(document.createTextNode(
      '\n '.repeat(MARGINS[1]) + (useVertical ? ''
          : ' '.repeat(width - uiWidth - 1)))
  );

  for (const button of uiElements) {
    const a = document.createElement("a");
    a.textContent = button.label;
    a.href = button.url;
    a.className = "link";
    if (button.onClick) a.onclick = (event) => {
      event.preventDefault();
      button.onClick?.(event);
    };

    const span = document.createElement("span");
    span.className = "button bg";

    span.appendChild(document.createTextNode("["));
    span.appendChild(a);
    span.appendChild(document.createTextNode("]"));

    buttonGrid.value.appendChild(span);
    buttonGrid.value.appendChild(document.createTextNode(useVertical ? '\n ' : ' '));
  }
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

const CHARS = ' .-=:*@@';
function makeAsciiString(time: number): string {
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

async function setDimensions() {
  if (!thisElement.value || !window) return;
  await document.fonts.load('20px trypewriter', 'M');

  fontSize.value = verticalLayout() ? 30 : 20;

  const rect = thisElement.value.getBoundingClientRect();
  width  = Math.floor(rect.width / measureCharWidth(fontSize.value));
  height = Math.floor(rect.height / fontSize.value);

  if (props.showButtons) addAllButtons();
}

function refreshCharacters() {
  if (!asciiGrid.value) return;

  asciiGrid.value.textContent = makeAsciiString(Date.now() / 1000);
}

useResize(setDimensions);
onMounted(async () => {
  // await document.fonts.ready;
  // console.log('fonts ready');
  refreshCharacters(); // Fill the ascii grid

  setInterval(refreshCharacters, 125); // Refresh ascii characters
});
</script>

<template>
  <div class="bg-grid" aria-hidden="true" ref="thisElement">
    <pre class="font-trypewriter bg" ref="asciiGrid"></pre>
    <pre class="font-trypewriter" ref="buttonGrid"></pre>
  </div>
</template>

<style>
.bg-grid {
  position: absolute;
  inset: 0;
  width: 100%;
  overflow: hidden;
  background-color: var(--col-background);
}

pre {
  display: block;
  position: absolute;
  margin: 0;
  color: var(--col-element);
  font-size: v-bind(fontSizePx);
  line-height: 1;
  min-height: 100%;
  letter-spacing: 0;
  white-space: pre;
  user-select: none;
}

pre.ascii {
  z-index: -1;
  color: var(--col-element);
  pointer-events: none;
}

pre.buttons {
  z-index: 1;
  color: var(--col-element);
}

span.bg {
  background-color: var(--col-background);
}

a.link {
  all: unset;
  cursor: pointer;
  text-decoration: none;
}

a.link:hover {
  text-decoration: underline;
}
</style>

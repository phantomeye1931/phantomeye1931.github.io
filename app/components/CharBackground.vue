<template>
  <div class="bg-grid" aria-hidden="true">
    <pre class="font-trypewriter">{{ grid }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {genNoiseGrid} from "~/utils/noise";

const props = defineProps({
  fontSizePx: { type: Number, default: 40 },
  opacity: { type: Number, default: 1 }
});

const chars = ' .:-=+*#%@';

const grid = ref('')

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

function makeGrid(rows: number, cols: number, time: number): string {
  const numericGrid = genNoiseGrid(rows, cols, time);

  let out = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const value = numericGrid[r][c];
      const charIndex = Math.floor(value * (chars.length - 1));
      out += chars[Math.max(0, Math.min(chars.length - 1, charIndex))];
    }
    if (r < rows - 1) out += '\n';
  }

  return out;
}

function setDimensions() {
  const charHeight = props.fontSizePx;
  const charWidth = measureCharWidth(props.fontSizePx);

  const cols = Math.floor(window.innerWidth / charWidth + 1);
  const rows = Math.floor(window.innerHeight / charHeight + 1);

  grid.value = makeGrid(rows, cols, Date.now() / 1000);
}

let resizeHandler: () => void

onMounted(() => {
  setDimensions();
  window.addEventListener('resize', setDimensions);

  const timer = setInterval(setDimensions, 1);
  onBeforeUnmount(() => {
    clearInterval(timer)
    window.removeEventListener('resize', resizeHandler);
  });
})
</script>

<style scoped>
.bg-grid {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  user-select: none;
  overflow: hidden;
  background-color: antiquewhite;
}

.bg-grid pre {
  margin: 0;
  font-size: v-bind('props.fontSizePx + "px"');
  line-height: 1;
  letter-spacing: 0;
  color: #5d5066;
  opacity: v-bind('props.opacity');
  white-space: pre;
}
</style>

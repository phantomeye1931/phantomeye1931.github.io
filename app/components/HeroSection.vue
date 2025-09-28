<template>
  <div class="container">
    <div class="text-section">
      <div class="title-wrapper">
        <h1 class="title">
          <template v-for="(char, index) in titleChars" :key="index">
            <span :style="{ visibility: index < currentIndex ? 'visible' : 'hidden' }">{{ char }}</span>
          </template>
        </h1>
      </div>

      <div class="pronunciation-wrapper">
        <div class="pronunciation">
          /'ɑɹ.mɑnt də ˈvris/
        </div>
      </div>

      <div class="info-wrapper">
        <div class="info-item">Computing Science Student</div>
        <div class="info-item">Code Enthusiast</div>
        <div class="info-item">Digital Artist</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const titleText = "ARMAND\nDE VRIES";
const titleChars = titleText.split('');

const currentIndex = ref(0);

onMounted(() => {
  const addLetter = () => {
    if (currentIndex.value < titleChars.length) {
      currentIndex.value++;
      setTimeout(addLetter, 50 + Math.random() * 150);
    }
  }
  addLetter();
});
</script>

<style scoped>
.container {
  min-height: 100vh;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 4rem 1rem 0 0;
  position: relative;
  z-index: 10;
  box-sizing: border-box;

  user-select: none;
  pointer-events: none;
}

.text-section {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-items: flex-end;
}

.title-wrapper {
  display: inline-block;
  background-color: var(--col-background);
  padding: 1rem 1.5rem;
}

.title {
  font-family: 'Playfair Display', serif;
  color: var(--col-text);

  font-weight: 900;
  font-size: 7rem;
  line-height: 1;
  margin: 0;
  white-space: pre; /* keep line breaks from \n */
}

.pronunciation-wrapper {
  display: inline-block;
  background-color: var(--col-background);
  padding: 0.5rem 2rem;
}

.pronunciation {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.7rem;
  color: var(--col-text-3);
}

.info-wrapper {
  display: inline-block;
  background-color: var(--col-background);
  font-family: 'Inter', sans-serif;
  color: var(--col-text-2);
  padding: 0.75rem 2rem;
  font-size: 1.5rem;
}
</style>

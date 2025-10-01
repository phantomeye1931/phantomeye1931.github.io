<script setup lang="ts">
import { defineProps } from 'vue'

defineProps<{
  text?: string
}>()
</script>

<template>
  <div class="tab">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="100%" height="100%" preserveAspectRatio="none" >
      <path
          d="
          M 0 1
          Q 0.03125 1 0.0625 0.75
          L 0.125 0.25
          Q 0.15625 0 0.1875 0
          L 0.859375 0
          Q 0.890625 0 0.921875 0.25
          L 0.984375 0.75
          Q 1 0.875 1 1
          Z"
      />
    </svg>
    <div class="text">{{text}}</div>
  </div>
</template>

<style scoped>
.tab {
  position: relative;
  width: 100%;
  height: 100%;
}

svg {
  width: 100%;
  height: 100%;
  fill: #ff00ff; /* To be overridden */
}

.text {
  position: absolute;
  top: 50%; /* Vertical center */
  transform: translateY(-50%);
  right: 2em; /* Padding on the right */
  color: #00ff00; /* To be overridden */
  font-size: 1em;
  text-align: right;
  pointer-events: none;
}
</style>

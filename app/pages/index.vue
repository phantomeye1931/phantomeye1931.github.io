<template>
  <div class="page_wrapper">
    <CharBackground showButtons />

    <div class="page_content">
      <HeroSection />

      <div class="top">
        <IntroSection />
        <WeblogSection />
      </div>
    </div>
  </div>
</template>

<style>
.page_wrapper {
  position: absolute;
  min-height: 100vh;
  width: 100%;
}

.page_wrapper .top {
  position: relative;
  z-index: 1;
}
</style>

<script setup lang="ts">

</script>
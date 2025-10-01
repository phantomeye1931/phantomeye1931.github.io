<script setup lang="ts">
import IFolderTab from "~/components/shapes/IFolderTab.vue";
import { useRouter } from 'vue-router';

interface FolderEntry {
  title: string;
  description: string;
  url: string;
  date: Date;
}

const folders: FolderEntry[] = [
  {
    title: "Making Stereograms",
    description: "A small dive into the technical details of stereograms.",
    url: "/weblog/making-stereograms",
    date: new Date("2025-09-30"),
  },
  {
    title: "Immersive Parallax",
    description: "A small dive into creating convincing parallax layers.",
    url: "/weblog/immersive-parallax",
    date: new Date("2025-10-01"),
  },
  {
    title: "Making of this website",
    description: "A short overview of the technical and artistic decisions that went into making this website.",
    url: "/weblog/making-of-this-website",
    date: new Date("2025-10-02"),
  },
];

const router = useRouter();

function goToFolder(url: string) {
  if (url.startsWith('http')) {
    window.location.href = url
  } else {
    router.push(url)
  }
}
</script>

<template>
  <div class="container">
    <div class="folders">
      <h1>Recent weblogs</h1>
      <div class="folder" v-for="(folder, index) in folders" :key="index">
        <IFolderTab class="foldertab outline"/>
        <IFolderTab class="foldertab" :text="folder.date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })" />
        <div class="paper" @click="goToFolder(folder.url)"
             :style="{ '--rotation': `${(-2 + Math.random() * 4).toFixed(2)}deg` }">
          <h1>{{ folder.title }}</h1>
          <p>{{ folder.description }}</p>
        </div>
      </div>

      <div class="folder front" />
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  justify-content: center;

  padding: 3em;
}

.folders > h1 {
  font-family: 'Playfair Display', serif;
  color: var(--col-text);
  background-color: var(--col-background);
}

.folders {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
}

.folder + .folder {
  margin-top: -220px;
  box-shadow: 0 -10px 15px -10px var(--col-drop-shadow);
}

.folder {
  width: 500px;
  height: 300px;
  background-color: var(--col-background);
  border-radius: 1em 0 1em 1em;
  border-top: 2px solid var(--col-text-3);
  position: relative;

  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.folder.front {
  border-radius: 1em;
}

.foldertab {
  width: 200px;
  height: 36px;

  position: absolute;
  top: -34px;
  right: 0;
}

.foldertab:deep(svg) {
  fill: var(--col-background);
}

.foldertab:deep(.text) {
  color: var(--col-text-2);
  font-family: 'JetBrains Mono', monospace;
}

.foldertab.outline {
  top: -36px;
  right: 0;
}

.foldertab.outline:deep(svg) {
  fill: var(--col-text-3);
}

.paper {
  background-color: var(--col-background-2);
  width: 90%;
  box-sizing: border-box;
  height: calc(100% - 1em);

  position: relative;

  padding: 0 1em;
  color: var(--col-text);

  filter: var(--drop-shadow);

  transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  --rotation: 0deg;
  transform: rotate(var(--rotation));
}

.paper:hover {
  transform: translate(0, -4em);
  cursor: pointer;
}

.paper h1 {
  font-size: 1.6em;
  font-family: 'Playfair Display', serif;
  color: var(--col-text);
}

.paper p {
  font-family: 'Inter', sans-serif;
  color: var(--col-text-2);
  width: 65%;
}
</style>
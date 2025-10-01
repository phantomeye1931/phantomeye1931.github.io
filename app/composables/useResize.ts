import { onMounted, onBeforeUnmount } from "vue";

export function useResize(callback: () => Promise<void>) {
onMounted(async () => {
    window.addEventListener("resize", async () => await callback());
    await callback();
});

onBeforeUnmount(() => {
    window.removeEventListener("resize", callback);
    });
}
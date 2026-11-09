import { shareMeta } from "~/utils/share-meta";

// Sets link-preview tags for the current page. The getter keeps them in step with the route,
// though crawlers only ever see the server-rendered HTML
export function useShareMeta(copy: () => { title: string; description: string }) {
  const origin = useRequestURL().origin;
  const route = useRoute();
  const meta = computed(() => shareMeta({ origin, path: route.fullPath, ...copy() }));
  useSeoMeta({
    description: () => meta.value.description,
    ogTitle: () => meta.value.ogTitle,
    ogDescription: () => meta.value.ogDescription,
    ogSiteName: () => meta.value.ogSiteName,
    ogType: () => meta.value.ogType,
    ogUrl: () => meta.value.ogUrl,
    ogImage: () => meta.value.ogImage,
    ogImageWidth: () => meta.value.ogImageWidth,
    ogImageHeight: () => meta.value.ogImageHeight,
    ogImageAlt: () => meta.value.ogImageAlt,
    twitterCard: () => meta.value.twitterCard,
    twitterTitle: () => meta.value.twitterTitle,
    twitterDescription: () => meta.value.twitterDescription,
    twitterImage: () => meta.value.twitterImage,
  });
}

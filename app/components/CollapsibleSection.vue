<script setup lang="ts">
import { AnimatePresence, motion } from "motion-v";

// A section that starts folded: for detail most visitors skip. The heading holds the button, so
// the section still shows up in a screen reader's list of headings while it's closed.
// large: a section heading with a round control. small: a line of body text, its content set off
// by an ink rule like the Taste Check's "About your ratings" note, for background beside the main
// content. The heading level stays whatever the outline needs, whichever size it looks
const props = withDefaults(defineProps<{ title: string; level?: 2 | 3 | 4; size?: "large" | "small" }>(), {
  level: 2,
  size: "large",
});

const open = ref(false);
const regionId = useId();
const heading = computed(() => `h${props.level}`);
const small = computed(() => props.size === "small");
</script>

<template>
  <section>
    <component :is="heading" :class="small ? 'text-base font-bold' : 'font-wide text-2xl font-black'">
      <button
        type="button"
        :aria-expanded="open"
        :aria-controls="regionId"
        class="flex items-center text-left focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ink"
        :class="small ? 'gap-1.5 underline underline-offset-4' : 'w-full justify-between gap-4'"
        @click="open = !open"
      >
        {{ title }}
        <!-- large: a small round control, like the play buttons. The chevron turns to point at what opened -->
        <span
          aria-hidden="true"
          class="grid shrink-0 place-items-center"
          :class="small ? '' : 'size-9 rounded-full border-3 border-ink'"
        >
          <motion.svg
            viewBox="0 0 12 12"
            class="fill-none stroke-current stroke-[2.5]"
            :class="small ? 'size-3' : 'size-3.5'"
            :animate="{ rotate: open ? 180 : 0 }"
            :transition="spring.smooth"
          >
            <path d="M2 4l4 4 4-4" stroke-linecap="square" />
          </motion.svg>
        </span>
      </button>
    </component>
    <AnimatePresence :initial="false">
      <motion.div
        v-if="open"
        :id="regionId"
        class="overflow-hidden"
        :initial="{ height: 0, opacity: 0 }"
        :animate="{ height: 'auto', opacity: 1 }"
        :exit="{ height: 0, opacity: 0 }"
        :transition="spring.smooth"
      >
        <div :class="small ? 'mt-2 border-l-3 border-ink pl-3 text-sm' : 'pt-2'">
          <slot />
        </div>
      </motion.div>
    </AnimatePresence>
  </section>
</template>

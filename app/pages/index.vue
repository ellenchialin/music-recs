<script setup lang="ts">
import { motion } from "motion-v";

// 首頁的流程，對應 SPEC 的使用者流程；之後換成真的輸入框和推薦卡片
const steps = ["輸入 3–5 位喜歡的歌手", "拿到 10 首附試聽的推薦", "盲聽測驗：推薦真的比隨機好嗎"];
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="mx-auto flex w-full max-w-7xl items-center px-4 py-5 sm:px-8">
      <span class="font-wide text-lg font-extrabold">Music Recs</span>
    </header>

    <main class="mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-4 pb-16 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <motion.h1
          v-bind="fadeUp"
          :transition="spring.smooth"
          class="font-wide text-[clamp(3.25rem,10vw,8rem)] leading-[0.88] font-black"
        >
          Music Recs
        </motion.h1>
        <motion.p
          v-bind="fadeUp"
          :transition="{ ...spring.smooth, delay: staggerStep }"
          class="mt-8 max-w-md text-xl leading-relaxed font-medium"
        >
          輸入喜歡的歌手，拿到附試聽的推薦，再用盲聽測驗看推薦準不準。
        </motion.p>
      </div>

      <!-- 參考插畫的構圖：青綠色的太陽圓，前面貼著深色的裝備標籤 -->
      <div class="relative mx-auto aspect-square w-full max-w-md lg:max-w-xl">
        <motion.div
          aria-hidden="true"
          class="absolute inset-0 rounded-full bg-teal"
          :initial="{ scale: 0.6, opacity: 0 }"
          :animate="{ scale: 1, opacity: 1 }"
          :transition="spring.smooth"
        />
        <ol class="absolute inset-x-0 bottom-[12%] flex flex-col items-start gap-3 px-4 sm:-left-10 sm:px-0">
          <motion.li
            v-for="(step, i) in steps"
            :key="step"
            v-bind="fadeUp"
            :transition="{ ...spring.snappy, delay: staggerStep * (i + 3) }"
            class="flex items-stretch border-3 border-ink bg-ink text-paper"
            :class="i === 1 ? 'ml-8 sm:ml-16' : i === 2 ? 'ml-2 sm:ml-6' : ''"
          >
            <span aria-hidden="true" class="w-3" :class="['bg-coral', 'bg-teal', 'bg-pink'][i]" />
            <span class="px-4 py-2.5 text-base font-medium">{{ step }}</span>
          </motion.li>
        </ol>
      </div>
    </main>

    <!-- 參考插畫腳下的深色地面 -->
    <motion.div
      aria-hidden="true"
      class="h-6 origin-left bg-ink"
      :initial="{ scaleX: 0 }"
      :animate="{ scaleX: 1 }"
      :transition="{ ...spring.smooth, delay: staggerStep * 2 }"
    />
  </div>
</template>

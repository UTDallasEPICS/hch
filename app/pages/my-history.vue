<script setup lang="ts">
  definePageMeta({
    // Client-only: auth.global.ts handles logged-out users, non-admin sends staff away.
    middleware: ['non-admin'],
  })
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Health history</h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Keep your medications and past experiences up to date for your care team. Your assigned
        clinician and clinic administrators can view what you add here.
      </p>
    </div>

    <MedicationHistorySection />
    <TraumaHistorySection class="mt-10" />
  </main>
</template>

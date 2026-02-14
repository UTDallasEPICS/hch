<template>
  <UContainer class="py-10">
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Tasks to complete:</h1>
    <div
      class="mt-6 flex items-center justify-between px-5 text-sm font-medium text-gray-600 dark:text-gray-300"
    >
      <span>Form</span>
      <span>Progress</span>
    </div>
    <UButton
      class="mt-3 w-full justify-between rounded-xl px-5 py-4 text-sm font-semibold"
      color="primary"
      variant="soft"
      to="/application"
    >
      <span>Application Form</span>
      <span>0/51</span>
    </UButton>
  </UContainer>
</template>

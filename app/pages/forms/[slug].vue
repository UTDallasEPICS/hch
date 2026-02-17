<script setup lang="ts">
definePageMeta({
  name: 'forms-slug',
})

const route = useRoute()
const slug = computed(() => {
  const slugParam = route.params.slug
  if (Array.isArray(slugParam)) {
    return slugParam[0] || ''
  }
  return (slugParam as string) || ''
})
</script>

<template>
  <FormPageContent :slug="slug" />
</template>

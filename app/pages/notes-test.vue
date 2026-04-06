<script setup lang="ts">
const today = new Date().toLocaleDateString('en-US', {
  month: 'numeric',
  day: 'numeric',
  year: 'numeric'
})
</script>

<template>
  <Notes
    :client="{ name: 'Client Name', id: '1' }"
    :current-note="{ id: 1, date: today, content: '' }"
    :previous-notes="[
      { id: 2, date: '2/27/2026', preview: 'Session went well...', content: '' },
      { id: 3, date: '1/15/2026', preview: 'Follow-up session...', content: '' },
    ]"
    :forms="[
      { label: 'Application Form', status: 'complete' },
      { label: 'ACE', status: 'pending' },
      { label: 'GAD-7', status: 'pending' },
      { label: 'PHQ-9', status: 'complete' },
      { label: 'PCL-5', status: 'complete' },
    ]"
  />
</template>

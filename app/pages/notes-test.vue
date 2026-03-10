<template>
  <NotesEditor
    :client="{ name: 'Client Name', id: '1' }"
    :current-note="{ id: 1, date: '3/10/2026', content: '' }"
    :previous-notes="[
      { id: 2, date: '1/27/2026', preview: 'Session went well...', content: 'Full previous note.' },
      { id: 3, date: '12/15/2025', preview: 'Follow-up session...', content: 'Another previous note.' },
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

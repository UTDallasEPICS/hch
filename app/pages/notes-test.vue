<template>
  <NotesViewer
    :client="{ name: 'Bertram', id: '1' }"
    :current-note="{ id: 1, date: '11/18/2022', content: 'This is the current session note.' }"
    :previous-notes="[
      { id: 2, date: '11/11/2022', preview: 'Session went well...', content: 'Full previous note.' },
      { id: 3, date: '11/04/2022', preview: 'Follow-up session...', content: 'Another previous note.' },
    ]"
    :forms="[
      { label: 'PCL-5', status: 'complete' },
      { label: 'GAD-7', status: 'pending' },
    ]"
  />
</template>

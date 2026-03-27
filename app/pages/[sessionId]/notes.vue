<script setup lang="ts">
const route = useRoute()
const sessionId = route.params.sessionId

const client = ref({ name: '', id: '' })
const currentNote = ref({ id: 0, date: '', content: '' })
const previousNotes = ref<{ id: number; date: string; preview: string; content: string }[]>([])
const forms = ref<{ label: string; status: 'complete' | 'pending' }[]>([])

const { data } = await useFetch(`/api/sessions/${sessionId}/notes`)

if (data.value) {
    client.value = (data.value as any).client
    currentNote.value = (data.value as any).currentNote
    previousNotes.value = (data.value as any).previousNotes
    forms.value = (data.value as any).forms
}
</script>

<template>
  <NotesViewer
    :client="client"
    :currentNote="currentNote"
    :previousNotes="previousNotes"
    :forms="forms"
  />
</template>
<script setup lang="ts">
  import { z } from 'zod'
  import type { FormSubmitEvent } from '#ui/types'
  import { authClient } from '../utils/auth-client'

  const toast = useToast()
  const isEmailSent = ref(false)
  const sessionRef = authClient.useSession()

  const schema = computed(() => {
    if (!isEmailSent.value) {
      return z.object({
        email: z.string().email('Invalid email'),
      })
    } else {
      return z.object({
        email: z.string().email('Invalid email'),
        otp: z.array(z.string()).length(6, 'Must be 6 digits'),
      })
    }
  })

  const state = reactive({
    email: '',
    otp: [] as string[],
  })

  async function waitForSession(timeoutMs = 5000) {
    if (sessionRef.value?.data) return
    await sessionRef.value?.refetch?.().catch(() => {})
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Session timeout')), timeoutMs)
      const stop = watch(
        () => sessionRef.value?.data,
        (data) => {
          if (data) {
            clearTimeout(timeout)
            stop()
            resolve()
          }
        },
        { immediate: true }
      )
    })
  }

  async function handleSubmit(event: FormSubmitEvent<any>) {
    if (!isEmailSent.value) {
      const { data, error } = await authClient.emailOtp.sendVerificationOtp({
        email: state.email,
        type: 'sign-in',
      })

      if (error) {
        toast.add({ title: 'Error', description: error.message, color: 'error' })
      } else {
        isEmailSent.value = true
        toast.add({ title: 'Success', description: 'OTP sent to your email', color: 'success' })
      }
    } else {
      const { data, error } = await authClient.signIn.emailOtp({
        email: state.email,
        otp: state.otp.join(''),
      })

      if (error) {
        toast.add({ title: 'Error', description: error.message, color: 'error' })
      } else {
        try {
          await waitForSession()
          await navigateTo('/')
        } catch {
          await navigateTo('/', { replace: true, external: true })
        }
      }
    }
  }
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950">
    <div
      class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Login</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Sign in with your email.</p>
      </div>

      <UForm :schema="schema" :state="state" @submit="handleSubmit" class="space-y-5">
        <UFormField name="email" v-if="!isEmailSent">
          <UInput v-model="state.email" class="w-full" placeholder="Email" />
        </UFormField>

        <UFormField name="otp" v-if="isEmailSent">
          <UPinInput
            otp
            v-model="state.otp"
            :length="6"
            size="xl"
            class="flex w-full items-center justify-center"
          />
        </UFormField>

        <UButton loading-auto type="submit" class="w-full justify-center" color="primary">
          {{ isEmailSent ? 'Login' : 'Send OTP' }}
        </UButton>
      </UForm>
    </div>
  </div>
</template>

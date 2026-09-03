import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './prisma'
import { emailOTP } from 'better-auth/plugins/email-otp'
import nodemailer from 'nodemailer'

const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
const trustedOrigins = [
  baseUrl,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
]

const emailUser = process.env.EMAIL_USER
const emailPass = process.env.EMAIL_PASS
const smtpReady = Boolean(emailUser && emailPass)

function wantsEmailOtpViaSmtp(): boolean {
  // Default OFF: in dev we print the OTP to the console rather than emailing it.
  // Set EMAIL_OTP_USE_SMTP=true to opt into real SMTP sending locally.
  const v = process.env.EMAIL_OTP_USE_SMTP?.trim().toLowerCase()
  if (!v) return false
  return v === 'true' || v === '1' || v === 'yes'
}

/**
 * Detect local dev without relying on import.meta.dev (often false in Nitro server bundles).
 * Evaluated at OTP send time so nitro:config can set NUXT_HCH_NITRO_DEV first.
 */
function isLocalAuthDevRuntime(): boolean {
  if (import.meta.dev) return true
  if (process.env.NUXT_HCH_NITRO_DEV === '1') return true
  const ev = process.env.npm_lifecycle_event
  if (ev === 'dev' || ev === 'nuxt:dev') return true
  return false
}

/** In dev: log OTP unless EMAIL_OTP_USE_SMTP is truthy and Gmail credentials exist. Prod: never. */
function shouldLogEmailOtpToConsole(): boolean {
  if (!isLocalAuthDevRuntime()) return false
  return !wantsEmailOtpViaSmtp()
}

let transporter: nodemailer.Transporter | null = null
function getSmtpTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    })
  }
  return transporter
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const auth = betterAuth({
  baseURL: baseUrl,
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Bootstrap: the very first person to sign in (on an empty DB, e.g. a
          // freshly reset stage or a local dev DB) becomes the ADMIN. Everyone
          // after is a CLIENT. The window only exists while zero users exist, so
          // once anyone has signed up no later signup can self-elevate.
          const existingUsers = await prisma.user.count()
          const role = existingUsers === 0 ? 'ADMIN' : 'CLIENT'
          return {
            data: {
              ...user,
              role,
            },
          }
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'CLIENT',
      },
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (shouldLogEmailOtpToConsole()) {
          console.info(
            `[email-otp] to=${email} type=${type} code=${String(otp)} (dev: printing OTP to console instead of emailing; set EMAIL_OTP_USE_SMTP=true to send via SMTP)`
          )
          return
        }
        if (!smtpReady) {
          throw new Error(
            'Email OTP is not configured: set EMAIL_USER and EMAIL_PASS (production), or run in dev without SMTP.'
          )
        }
        await getSmtpTransporter().sendMail({
          from: emailUser,
          to: email,
          subject: '[HCH] Your sign-in code',
          html: `<p>Your verification code is:</p><p><strong>${escapeHtml(String(otp))}</strong></p>`,
        })
      },
    }),
  ],
})

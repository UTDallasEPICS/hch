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

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export const auth = betterAuth({
  baseURL: baseUrl,
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  user: {
    additionalFields: {
      role: 'role',
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'OTP',
          html: `${otp}`,
        })
      },
    }),
  ],
})

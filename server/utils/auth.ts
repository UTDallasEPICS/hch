import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './prisma'
import { emailOTP } from 'better-auth/plugins/email-otp'
import nodemailer from 'nodemailer'

const localDevOrigins = ['http://localhost:3000', 'http://localhost:3001']
const configuredOrigin = process.env.BETTER_AUTH_URL
const trustedOrigins = Array.from(
  new Set([...localDevOrigins, ...(configuredOrigin ? [configuredOrigin] : [])])
)

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export const auth = betterAuth({
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
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

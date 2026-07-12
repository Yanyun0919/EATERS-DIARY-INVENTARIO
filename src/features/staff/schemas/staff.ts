import { z } from 'zod'

const staffRoleEnum = z.enum(['administrator', 'manager', 'purchasing', 'staff'])

export const staffCreateSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().min(1, 'Email is required').email('Invalid email'),
  role: staffRoleEnum,
  storeIds: z.array(z.string()),
  isActive: z.boolean(),
})

export type StaffCreateValues = z.infer<typeof staffCreateSchema>

export const staffGeneralSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(200),
  role: staffRoleEnum,
  isActive: z.boolean(),
})

export type StaffGeneralValues = z.infer<typeof staffGeneralSchema>

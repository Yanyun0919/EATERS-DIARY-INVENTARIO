import { z } from 'zod'

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
})

export type CategoryFormValues = z.infer<typeof categoryFormSchema>

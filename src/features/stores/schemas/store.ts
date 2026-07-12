import { z } from 'zod'

export const storeFormSchema = z.object({
  brandId: z.string().min(1, 'Brand is required'),
  name: z.string().trim().min(1, 'Name is required').max(200),
  code: z.string().trim().min(1, 'Store code is required').max(50),
  address: z.string().trim().max(500),
  isActive: z.boolean(),
})

export type StoreFormValues = z.infer<typeof storeFormSchema>

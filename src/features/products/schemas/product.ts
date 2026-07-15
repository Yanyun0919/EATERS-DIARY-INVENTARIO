import { z } from 'zod'

export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  categoryId: z.string().min(1, 'Category is required'),
  baseUnitId: z.string().min(1, 'Inventory unit is required'),
  supplySourceId: z.string().min(1, 'Supply Source is required'),
  minimumStock: z.coerce.number().min(0, 'Must be 0 or more'),
  isStockTracked: z.boolean(),
})

export type ProductFormValues = z.infer<typeof productFormSchema>

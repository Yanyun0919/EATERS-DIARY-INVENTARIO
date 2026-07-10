import { z } from 'zod'

export const supplierFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  nifCif: z.string().trim().max(20),
  contactName: z.string().trim().max(200),
  email: z.string().trim().max(200),
  phone: z.string().trim().max(50),
  address: z.string().trim().max(500),
  paymentTerms: z.string().trim().max(200),
})

export type SupplierFormValues = z.infer<typeof supplierFormSchema>

export const purchaseUnitOptions = ['kg', 'g', 'L', 'ml', 'other'] as const

export const productSupplierFormSchema = z
  .object({
    productId: z.string().min(1, 'Product is required'),
    supplierSku: z.string().trim().max(100),
    unitPrice: z.coerce.number().min(0, 'Must be 0 or more'),
    purchaseUnit: z.enum(purchaseUnitOptions),
    purchaseUnitSpec: z.string().trim().max(200),
    moq: z.coerce.number().gt(0, 'Must be greater than 0'),
    leadTimeDays: z.coerce.number().int().min(0).nullable(),
    ivaRate: z.coerce.number().min(0, 'Must be 0 or more'),
    isPreferred: z.boolean(),
    isAvailable: z.boolean(),
  })
  .refine((value) => value.purchaseUnit !== 'other' || value.purchaseUnitSpec.length > 0, {
    message: 'Specification is required when Purchase Unit is "Other"',
    path: ['purchaseUnitSpec'],
  })

export type ProductSupplierFormValues = z.infer<typeof productSupplierFormSchema>

import { z } from 'zod'

export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  sku: z.string().trim().max(100),
  categoryId: z.string(),
  baseUnitId: z.string().min(1, 'Base unit is required'),
  isStockTracked: z.boolean(),
})

export type ProductFormValues = z.infer<typeof productFormSchema>

export const supplierProductFormSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  supplierSku: z.string().trim().max(100),
  unitPrice: z.coerce.number().min(0, 'Must be 0 or more'),
  purchaseUnitId: z.string().min(1, 'Purchase unit is required'),
  moq: z.coerce.number().gt(0, 'Must be greater than 0'),
  leadTimeDays: z.coerce.number().int().min(0).nullable(),
  ivaRate: z.coerce.number().min(0, 'Must be 0 or more'),
  isPreferred: z.boolean(),
  isAvailable: z.boolean(),
})

export type SupplierProductFormValues = z.infer<typeof supplierProductFormSchema>

export const unitConversionFormSchema = z
  .object({
    fromUnitId: z.string().min(1, 'From unit is required'),
    toUnitId: z.string().min(1, 'To unit is required'),
    factor: z.coerce.number().gt(0, 'Must be greater than 0'),
  })
  .refine((value) => value.fromUnitId !== value.toUnitId, {
    message: 'From and to units must be different',
    path: ['toUnitId'],
  })

export type UnitConversionFormValues = z.infer<typeof unitConversionFormSchema>

export const aliasFormSchema = z.object({
  alias: z.string().trim().min(1, 'Value is required').max(200),
  aliasType: z.enum(['translation', 'supplier_name', 'barcode']),
  languageCode: z.string().trim().max(10),
})

export type AliasFormValues = z.infer<typeof aliasFormSchema>

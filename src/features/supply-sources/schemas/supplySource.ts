import { z } from 'zod'

export const supplySourceFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    resolutionType: z.enum(['external', 'internal']),
    storeId: z.string().nullable(),
    sortOrder: z.number().int(),
    isActive: z.boolean(),
  })
  // A Locale is required for 'internal' sources and forbidden for 'external' ones -- mirrors
  // the database shape exactly (migration 025: supply_source_locale_config only ever has a
  // row for 'internal' sources).
  .refine((values) => values.resolutionType !== 'internal' || Boolean(values.storeId), {
    message: 'A Locale is required for an internal Supply Source',
    path: ['storeId'],
  })

export type SupplySourceFormValues = z.infer<typeof supplySourceFormSchema>

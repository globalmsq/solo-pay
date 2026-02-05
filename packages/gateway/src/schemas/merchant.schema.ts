import { z } from 'zod';

// Merchant update request schema. merchant_key is not updatable.
export const UpdateMerchantSchema = z
  .object({
    name: z.string().min(1, 'Merchant name is required').optional(),
    chain_id: z.number().int().positive().optional(),
    webhook_url: z.string().url('Webhook URL must be a valid URL').optional(),
    allowed_domains: z.array(z.string().url('Each domain must be a valid URL')).optional(),
  })
  .strict(); // Reject unknown keys (e.g. merchant_key) so merchant_key cannot be updated via API

export type UpdateMerchantRequest = z.infer<typeof UpdateMerchantSchema>;

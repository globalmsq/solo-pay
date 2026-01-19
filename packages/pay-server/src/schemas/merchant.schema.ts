import { z } from 'zod';

// Merchant update request schema
export const UpdateMerchantSchema = z.object({
  name: z.string().min(1, 'Merchant name is required').optional(),
  chain_id: z.number().int().positive().optional(),
  webhook_url: z.string().url('Webhook URL must be a valid URL').optional(),
});

export type UpdateMerchantRequest = z.infer<typeof UpdateMerchantSchema>;

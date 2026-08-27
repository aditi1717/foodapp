import { z } from "zod";
import { ValidationError } from "./errors.js";

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Referral code is required")
    .max(32, "Referral code is too long"),
});

export const validateReferralCodeParam = (params) => {
  const result = schema.safeParse({
    code: params?.code,
  });
  if (!result.success) {
    throw new ValidationError(result.error.errors[0].message);
  }
  return result.data;
};

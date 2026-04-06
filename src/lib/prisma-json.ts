import { Prisma } from "@prisma/client";

export function toPrismaJson(
  value: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export function toOptionalPrismaJson(
  value: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  return value === undefined ? undefined : toPrismaJson(value);
}

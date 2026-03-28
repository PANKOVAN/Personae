import { v7 as uuidv7 } from "uuid";

/** Новый идентификатор сущности (UUID v7, упорядочиваемый по времени). */
export function newEntityId(): string {
  return uuidv7();
}

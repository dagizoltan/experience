
// src/core/ports/ids.js
import { ulid } from "npm:ulid"

export const createIds = () => ({
  next: () => ulid()
})

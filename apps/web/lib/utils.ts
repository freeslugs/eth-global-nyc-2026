import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function shortHash(hash: string, head = 10, tail = 6): string {
  const body = hash.startsWith("sha256:") ? hash.slice(7) : hash;
  if (body.length <= head + tail) return hash;
  return `sha256:${body.slice(0, head)}…${body.slice(-tail)}`;
}

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper padrão do Shadcn: combina clsx (condicional) + twMerge
// (resolve conflitos entre classes do Tailwind, ex.: "p-2 p-4" -> "p-4").
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

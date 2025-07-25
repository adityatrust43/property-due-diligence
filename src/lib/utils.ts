import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) {
    return "N/A";
  }
  try {
    const [year, month, day] = dateString.split('-').map(s => s.padStart(2, '0'));
    if (!year || !month || !day) return dateString; // Return original if format is unexpected
    return `${day}.${month}.${year}`;
  } catch (error) {
    return dateString; // Return original string if parsing fails
  }
}

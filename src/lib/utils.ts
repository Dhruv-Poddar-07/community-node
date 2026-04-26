import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const INDIAN_CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", 
  "Hyderabad", "Pune", "Jaipur", "Lucknow", "Patna", 
  "Kochi", "Ahmedabad", "Surat"
] as const

export const SKILLS = [
  "Teaching", "First Aid", "Medical", "Engineering", "Legal Aid",
  "Tree Plantation", "Elder Care", "Tutoring", "Digital Literacy",
  "Sports Coaching", "Storytelling", "Library Setup", "Skill Training",
  "Women's Health", "Community Garden", "Park Cleanup"
] as const

export const CATEGORIES = [
  "Education", "Healthcare", "Environment", "Social Services", 
  "Emergency Relief", "Community Development"
] as const

export const URGENCY_LEVELS = {
  critical: { label: "Critical", color: "red" },
  high: { label: "High", color: "orange" },
  medium: { label: "Medium", color: "yellow" },
  low: { label: "Low", color: "green" }
} as const

export const BADGE_TIERS = {
  newcomer: { label: "Newcomer", minTasks: 0 },
  helper: { label: "Helper", minTasks: 5 },
  contributor: { label: "Contributor", minTasks: 15 },
  champion: { label: "Champion", minTasks: 30 },
  legend: { label: "Legend", minTasks: 50 }
} as const

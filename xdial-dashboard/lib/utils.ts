import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * User storage utilities that work across browser tabs
 * Uses localStorage as the primary storage with sessionStorage as backup
 * This allows new tabs to access user data
 */

export interface User {
  id?: number
  client_id?: number
  username?: string
  role?: string
  name?: string
  extension?: string
}

/**
 * Get user data from storage (checks both localStorage and sessionStorage)
 */
export function getUserFromStorage(): User | null {
  if (typeof window === 'undefined') return null
  
  // Try sessionStorage first (preferred for current tab)
  let userStr = sessionStorage.getItem('user')
  let userType = sessionStorage.getItem('userType')
  
  // If not found in sessionStorage, try localStorage (for new tabs)
  if (!userStr || !userType) {
    userStr = localStorage.getItem('user')
    userType = localStorage.getItem('userType')
    
    // If found in localStorage but not sessionStorage, sync to sessionStorage
    if (userStr && userType) {
      sessionStorage.setItem('user', userStr)
      sessionStorage.setItem('userType', userType)
    }
  }
  
  if (!userStr) return null
  
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

/**
 * Get user type from storage (checks both localStorage and sessionStorage)
 */
export function getUserTypeFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  
  let userType = sessionStorage.getItem('userType')
  
  if (!userType) {
    userType = localStorage.getItem('userType')
    
    // If found in localStorage but not sessionStorage, sync
    if (userType) {
      sessionStorage.setItem('userType', userType)
    }
  }
  
  return userType
}

/**
 * Store user data in both localStorage and sessionStorage
 */
export function setUserInStorage(user: User, userType: string): void {
  if (typeof window === 'undefined') return
  
  const userStr = JSON.stringify(user)
  
  // Store in both storages
  sessionStorage.setItem('user', userStr)
  sessionStorage.setItem('userType', userType)
  localStorage.setItem('user', userStr)
  localStorage.setItem('userType', userType)
}

/**
 * Clear user data from both storages
 */
export function clearUserFromStorage(): void {
  if (typeof window === 'undefined') return
  
  sessionStorage.removeItem('user')
  sessionStorage.removeItem('userType')
  localStorage.removeItem('user')
  localStorage.removeItem('userType')
}
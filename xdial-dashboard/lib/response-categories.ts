// lib/response-categories.ts
// Centralized response category management

export type ResponseCategory = 
  | 'Interested'
  | 'Not_Interested' 
  | 'Answering_Machine'
  | 'DNC'
  | 'DNQ'
  | 'Unknown'
  | 'User_Silent'
  | 'HUMAN'
  | 'ANSWERED'
  | 'VOICEMAIL'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'FAILED'
  | 'ERROR'
  | 'EXTERNAL_RECORDING'

export type FilterCategoryId = 
  | 'interested'
  | 'not-interested'
  | 'answering-machine'
  | 'do-not-call'
  | 'do-not-qualify'
  | 'unknown'
  | 'user-silent'

export interface CategoryDefinition {
  id: FilterCategoryId
  dbValue: ResponseCategory
  title: string
  description: string
  color: string
  iconColor: string
  group: 'positive' | 'negative' | 'neutral' | 'technical' | 'errors' | 'external'
}

// Master category definitions
export const RESPONSE_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'interested',
    dbValue: 'Interested',
    title: 'Interested',
    description: 'Positive response, wants more information',
    color: 'bg-green-100 text-green-800',
    iconColor: 'text-green-500',
    group: 'positive'
  },
  {
    id: 'not-interested', 
    dbValue: 'Not_Interested',
    title: 'Not Interested',
    description: 'Polite decline or not interested',
    color: 'bg-red-100 text-red-800',
    iconColor: 'text-red-500',
    group: 'negative'
  },
  {
    id: 'answering-machine',
    dbValue: 'Answering_Machine', 
    title: 'Answering Machine',
    description: 'Voicemail or answering machine detected',
    color: 'bg-blue-100 text-blue-800',
    iconColor: 'text-blue-500',
    group: 'technical'
  },
  {
    id: 'do-not-call',
    dbValue: 'DNC',
    title: 'Do Not Call', 
    description: 'Requested to be removed from calling list',
    color: 'bg-red-200 text-red-900',
    iconColor: 'text-pink-500',
    group: 'negative'
  },
  {
    id: 'do-not-qualify',
    dbValue: 'DNQ',
    title: 'Do Not Qualify',
    description: 'Does not meet qualification criteria', 
    color: 'bg-orange-100 text-orange-800',
    iconColor: 'text-yellow-500',
    group: 'neutral'
  },
  {
    id: 'unknown',
    dbValue: 'Unknown',
    title: 'Unknown', 
    description: 'Unclear or undetermined response',
    color: 'bg-gray-100 text-gray-800',
    iconColor: 'text-gray-500',
    group: 'neutral'
  },
  {
    id: 'user-silent',
    dbValue: 'User_Silent',
    title: 'User Silent',
    description: 'Person answered but did not respond',
    color: 'bg-yellow-100 text-yellow-800', 
    iconColor: 'text-yellow-600',
    group: 'neutral'
  }
]

// Database to UI mapping
export const DB_TO_FILTER_MAPPING: Record<ResponseCategory, FilterCategoryId | null> = {
  'Interested': 'interested',
  'Not_Interested': 'not-interested',
  'Answering_Machine': 'answering-machine', 
  'DNC': 'do-not-call',
  'DNQ': 'do-not-qualify',
  'Unknown': 'unknown',
  'User_Silent': 'user-silent',
  'HUMAN': 'interested', // Map to interested for UI
  'ANSWERED': 'interested', // Map to interested for UI
  'VOICEMAIL': 'answering-machine', // Map to answering machine
  'NO_ANSWER': 'unknown', // Map to unknown
  'BUSY': 'unknown', // Map to unknown  
  'FAILED': null, // Don't show in filters
  'ERROR': null, // Don't show in filters
  'EXTERNAL_RECORDING': null // Don't show in filters
}

// UI to Database mapping
export const FILTER_TO_DB_MAPPING: Record<FilterCategoryId, ResponseCategory[]> = {
  'interested': ['Interested', 'HUMAN', 'ANSWERED'],
  'not-interested': ['Not_Interested'],
  'answering-machine': ['Answering_Machine', 'VOICEMAIL'],
  'do-not-call': ['DNC'],
  'do-not-qualify': ['DNQ'], 
  'unknown': ['Unknown', 'NO_ANSWER', 'BUSY'],
  'user-silent': ['User_Silent']
}

// Utility functions
export const normalizeCategory = (input: string): ResponseCategory => {
  const normalized = input.trim().replace(/\s+/g, '_')
  
  const mapping: Record<string, ResponseCategory> = {
    'interested': 'Interested',
    'not_interested': 'Not_Interested',
    'not interested': 'Not_Interested', 
    'answering_machine': 'Answering_Machine',
    'answering machine': 'Answering_Machine',
    'voicemail': 'VOICEMAIL',
    'do_not_call': 'DNC',
    'do not call': 'DNC',
    'does_not_qualify': 'DNQ', 
    'does not qualify': 'DNQ',
    'unknown': 'Unknown',
    'user_silent': 'User_Silent',
    'user silent': 'User_Silent',
    'human': 'HUMAN',
    'answered': 'ANSWERED',
    'no_answer': 'NO_ANSWER',
    'no answer': 'NO_ANSWER',
    'busy': 'BUSY',
    'failed': 'FAILED',
    'error': 'ERROR',
    'external_recording': 'EXTERNAL_RECORDING',
    'external recording': 'EXTERNAL_RECORDING'
  }
  
  return mapping[normalized.toLowerCase()] || 'Unknown'
}

export const getCategoryColor = (category: ResponseCategory): string => {
  const categoryDef = RESPONSE_CATEGORIES.find(c => c.dbValue === category)
  if (categoryDef) return categoryDef.color
  
  // Fallback for categories not in main list
  switch (category.toUpperCase()) {
    case 'HUMAN':
    case 'ANSWERED':
      return 'bg-green-100 text-green-800'
    case 'VOICEMAIL':
      return 'bg-blue-100 text-blue-800'
    case 'NO_ANSWER':
    case 'BUSY': 
      return 'bg-yellow-100 text-yellow-800'
    case 'FAILED':
    case 'ERROR':
      return 'bg-red-200 text-red-900'
    case 'EXTERNAL_RECORDING':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export const getCategoryByFilterId = (filterId: FilterCategoryId): CategoryDefinition | null => {
  return RESPONSE_CATEGORIES.find(c => c.id === filterId) || null
}

export const getFilterIdByDbValue = (dbValue: ResponseCategory): FilterCategoryId | null => {
  return DB_TO_FILTER_MAPPING[dbValue] || null
}

export const getDbValuesByFilterId = (filterId: FilterCategoryId): ResponseCategory[] => {
  return FILTER_TO_DB_MAPPING[filterId] || []
}

export const isValidResponseCategory = (category: string): category is ResponseCategory => {
  return Object.keys(DB_TO_FILTER_MAPPING).includes(category)
}

// For API responses
export interface CategoryStats {
  category: ResponseCategory
  count: number
  percentage: number
  filterId?: FilterCategoryId
}

export const aggregateCategoryStats = (rawStats: {category: string, count: number}[]): CategoryStats[] => {
  const total = rawStats.reduce((sum, stat) => sum + stat.count, 0)
  
  return rawStats
    .filter(stat => isValidResponseCategory(stat.category))
    .map(stat => ({
      category: stat.category as ResponseCategory,
      count: stat.count,
      percentage: total > 0 ? Math.round((stat.count / total) * 100 * 100) / 100 : 0,
      filterId: getFilterIdByDbValue(stat.category as ResponseCategory)
    }))
    .sort((a, b) => b.count - a.count)
}

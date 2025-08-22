<div className="border-t border-yellow-300 pt-2 mt-3">
          <strong>Quick Test Cases (What should happen):</strong>
          <div className="ml-2 space-y-1 text-xs">
            <div><strong>Pakistan 13:00 →</strong> Should be 08:00 UTC (13:00 - 5 hours)</div>
            <div><strong>USA Eastern 13:00 →</strong> Should be 17:00 UTC (13:00 + 4 hours for EDT)</div>
            <div className="mt-2"><strong>Current Results:</strong></div>
            <div><strong>Pakistan 13:00 →</strong> {selectedTimezone === 'PAKISTAN' ? formatDateForAPI('2025-08-21', '13:00', false) : 'Switch to Pakistan to test'}</div>
            <div><strong>USA 13:00 →</strong> {selectedTimezone === 'USA' ? formatDateForAPI('2025-08-21', '13:00', false) : 'Switch to USA to test'}</div>
          </div>
        </div>// components/debug-filter.tsx - Temporary component for debugging
// Save this file as: components/debug-filter.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DebugFilterProps {
  filters: {
    startDate: string
    endDate: string
    startTime: string
    endTime: string
    search: string
    selectedOutcomes: string[]
  }
}

export function DebugFilter({ filters }: DebugFilterProps) {
  const formatDateForAPI = (dateString: string, timeString: string = "", isEndDate = false) => {
    if (!dateString) return null
    
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    
    if (timeString) {
      const [hours, minutes] = timeString.split(':').map(Number)
      date.setHours(hours, minutes, 0, 0)
    } else {
      if (isEndDate) {
        date.setHours(23, 59, 59, 999)
      } else {
        date.setHours(0, 0, 0, 0)
      }
    }
    
    return date.toISOString()
  }

  return (
    <Card className="mt-4 border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="text-sm text-yellow-800">Debug: Filter Values</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-yellow-700 space-y-2">
        <div>
          <strong>Raw Start Date:</strong> {filters.startDate || 'Not set'}
        </div>
        <div>
          <strong>Raw End Date:</strong> {filters.endDate || 'Not set'}
        </div>
        <div>
          <strong>Raw Start Time:</strong> {filters.startTime || 'Not set'}
        </div>
        <div>
          <strong>Raw End Time:</strong> {filters.endTime || 'Not set'}
        </div>
        <div>
          <strong>Processed Start Date:</strong> {filters.startDate ? formatDateForAPI(filters.startDate, filters.startTime, false) : 'Not set'}
        </div>
        <div>
          <strong>Processed End Date:</strong> {filters.endDate ? formatDateForAPI(filters.endDate, filters.endTime, true) : 'Not set'}
        </div>
        <div>
          <strong>Search:</strong> {filters.search || 'Not set'}
        </div>
        <div>
          <strong>Selected Outcomes:</strong> {filters.selectedOutcomes.length > 0 ? filters.selectedOutcomes.join(', ') : 'None'}
        </div>
        <div>
          <strong>Current Timezone:</strong> {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
        <div>
          <strong>Current Time:</strong> {new Date().toISOString()}
        </div>
      </CardContent>
    </Card>
  )
}
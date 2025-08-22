// components/debug-filter.tsx - Temporary component for debugging
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DebugFilterProps {
  filters: {
    startDate: string
    endDate: string
    search: string
    selectedOutcomes: string[]
  }
}

export function DebugFilter({ filters }: DebugFilterProps) {
  const formatDateForAPI = (dateString: string, isEndDate = false) => {
    if (!dateString) return null
    
    const date = new Date(dateString)
    
    if (isEndDate) {
      date.setHours(23, 59, 59, 999)
    } else {
      date.setHours(0, 0, 0, 0)
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
          <strong>Processed Start Date:</strong> {filters.startDate ? formatDateForAPI(filters.startDate, false) : 'Not set'}
        </div>
        <div>
          <strong>Processed End Date:</strong> {filters.endDate ? formatDateForAPI(filters.endDate, true) : 'Not set'}
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
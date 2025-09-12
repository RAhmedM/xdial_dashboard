"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Play, ChevronLeft, ChevronRight } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"

interface Call {
  call_id: number
  client_id: number
  phone_number: string
  response_category: string
  timestamp: string
  recording_url: string
  recording_length: number
  list_id: string | null  // Added List_id field
  client_name: string
}

interface User {
  id?: number
  username?: string
  role?: string
  name?: string
  extension?: string
}

interface CallRecordsProps {
  filters?: any
  user?: User | null
  userType?: string | null
}

export function CallRecordsUpdated({ filters = {}, user, userType }: CallRecordsProps) {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })

  const { toast } = useToast()

  useEffect(() => {
    fetchCalls()
  }, [filters, pagination.page, pagination.limit])

  const fetchCalls = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      // Add filters
      if (filters.search) params.append('search', filters.search)
      if (filters.startDate) params.append('start_date', filters.startDate)
      if (filters.endDate) params.append('end_date', filters.endDate)
      if (filters.selectedOutcomes?.length > 0) {
        filters.selectedOutcomes.forEach((outcome: string) => {
          params.append('response_categories', outcome)
        })
      }
      
      // Add client filter for non-admin users
      if (userType === 'client' && user?.id) {
        params.append('client_id', user.id.toString())
      }

      // Add pagination
      params.append('page', pagination.page.toString())
      params.append('limit', pagination.limit.toString())

      const response = await fetch(`/api/calls?${params}`)
      if (!response.ok) throw new Error('Failed to fetch calls')

      const data = await response.json()
      setCalls(data.calls)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching calls:', error)
      toast({
        title: "Error",
        description: "Failed to fetch call records",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'N/A'
    
    try {
      const date = new Date(timestamp)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
    } catch (error) {
      return timestamp
    }
  }

  const handlePlayRecording = (recordingUrl: string) => {
    if (recordingUrl) {
      window.open(recordingUrl, '_blank')
    } else {
      toast({
        title: "No Recording",
        description: "No recording available for this call",
        variant: "destructive"
      })
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'interested':
        return 'bg-green-500'
      case 'not-interested':
      case 'not interested':
        return 'bg-red-500'
      case 'answering-machine':
      case 'answering machine':
        return 'bg-blue-500'
      case 'do-not-call':
      case 'do not call':
        return 'bg-pink-500'
      case 'do-not-qualify':
      case 'do not qualify':
        return 'bg-yellow-500'
      case 'unknown':
        return 'bg-gray-500'
      default:
        return 'bg-gray-400'
    }
  }

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call Records ({pagination.total} total)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">#</th>
                    {userType === 'admin' && (
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Client</th>
                    )}
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Phone No</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">List ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Response Category</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Timestamp</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.call_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">{call.call_id}</td>
                      {userType === 'admin' && (
                        <td className="py-3 px-4 text-sm text-gray-900">{call.client_name}</td>
                      )}
                      <td className="py-3 px-4 text-sm text-gray-900">{call.phone_number}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{call.list_id || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <Badge className={`${getCategoryColor(call.response_category)} text-white`}>
                          {call.response_category}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{formatTimestamp(call.timestamp)}</td>
                      <td className="py-3 px-4">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handlePlayRecording(call.recording_url)}
                          disabled={!call.recording_url}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {calls.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {userType === 'client' 
                    ? "No call records found for your account." 
                    : "No call records found."
                  }
                </div>
              )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing page {pagination.page} of {pagination.totalPages} 
                  ({pagination.total} total records)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, pagination.page - 2) + i
                      if (pageNum > pagination.totalPages) return null
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === pagination.page ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
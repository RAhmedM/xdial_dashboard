"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Play, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Call {
  call_id: number
  client_id: number
  phone_number: string
  response_category: string
  timestamp: string
  recording_url: string
  recording_length: number
  client_name: string
}

interface User {
  id?: number
  username?: string
  role?: string
  name?: string
  extension?: string
}

export function CallRecordsUpdated() {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [user, setUser] = useState<User | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0
  })
  const { toast } = useToast()

  // Get user info on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = sessionStorage.getItem('user')
      const storedUserType = sessionStorage.getItem('userType')
      
      if (storedUser) {
        setUser(JSON.parse(storedUser))
      }
      if (storedUserType) {
        setUserType(storedUserType)
      }
    }
  }, [])

  const fetchCalls = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search })
      })

      // Add client_id filter for non-admin users
      if (userType === 'client' && user?.id) {
        params.append('client_id', user.id.toString())
      }

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

  useEffect(() => {
    // Only fetch calls after we have user info
    if (userType) {
      fetchCalls()
    }
  }, [pagination.page, search, userType, user])

  const getCategoryColor = (category: string) => {
    if (category.toLowerCase().includes('interested')) return "bg-green-500"
    if (category.toLowerCase().includes('silent')) return "bg-yellow-500"
    if (category.toLowerCase().includes('machine')) return "bg-blue-500"
    if (category.toLowerCase().includes('unknown')) return "bg-gray-500"
    return "bg-purple-500"
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
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

  // Show loading while we're getting user info
  if (!userType) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Call Records</CardTitle>
            {userType === 'client' && user?.name && (
              <p className="text-sm text-gray-500 mt-1">
                Showing calls for: {user.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search phone numbers..." 
                className="pl-10 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <span className="text-sm text-gray-500">{pagination.limit} per page</span>
          </div>
        </div>
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
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} results
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
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
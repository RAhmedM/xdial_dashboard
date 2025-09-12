// app/dashboard/page.tsx
"use client"

import { useState, useEffect } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { AuthWrapper } from "@/components/auth-wrapper"
import { Toaster } from "@/components/ui/toaster"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Calendar,
  RotateCcw,
  Search,
  Play,
  ChevronLeft,
  ChevronRight,
  X,
  Phone,
  Star,
  Ban,
  AlertTriangle,
  HelpCircle,
  PhoneForwarded,
  PhoneOff,
  Globe
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DebugFilter } from "@/components/debug-filter"

interface FilterState {
  search: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  selectedOutcomes: string[]
}

// Timezone constants
const TIMEZONES = {
  PAKISTAN: 'Asia/Karachi',
  USA: 'America/New_York'
} as const

type TimezoneKey = keyof typeof TIMEZONES

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

interface CallStats {
  totalCalls: number
  callsForwarded: number
  callsDropped: number
  categories: Array<{ name: string; count: number }>
}

interface OutcomeCounts {
  [key: string]: number
}

const callOutcomes = [
  {
    id: "answering-machine",
    title: "Answering Machine",
    icon: Phone,
    iconColor: "text-blue-500",
  },
  {
    id: "interested",
    title: "Interested",
    icon: Star,
    iconColor: "text-green-500",
  },
  {
    id: "not-interested",
    title: "Not Interested",
    icon: X,
    iconColor: "text-red-500",
  },
  {
    id: "do-not-call",
    title: "Do Not Call",
    icon: Ban,
    iconColor: "text-pink-500",
  },
  {
    id: "do-not-qualify",
    title: "Do Not Qualify",
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
  },
  {
    id: "unknown",
    title: "Unknown",
    icon: HelpCircle,
    iconColor: "text-gray-500",
  },
]

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    selectedOutcomes: [],
  })

  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [selectedTimezone, setSelectedTimezone] = useState<TimezoneKey>('PAKISTAN')
  const [outcomeCounts, setOutcomeCounts] = useState<OutcomeCounts>({})

  const { toast } = useToast()

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

  useEffect(() => {
    fetchCalls()
    fetchOutcomeCounts()
  }, [filters, pagination.page, pagination.limit])

  // Format timestamp based on selected timezone
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'N/A'
    
    try {
      const date = new Date(timestamp)
      const timezone = TIMEZONES[selectedTimezone]
      
      const usTime = date.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
      
      const pakistanTime = date.toLocaleString('en-US', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
      
      return `${usTime} (Pakistan: ${pakistanTime})`
    } catch (error) {
      console.error('Error formatting timestamp:', error)
      return timestamp
    }
  }

  // Helper function to format date for API
  const formatDateForAPI = (date: string, time: string, isEndOfDay: boolean = false) => {
    if (!date) return null
    
    try {
      let timeToUse = time
      if (!timeToUse) {
        timeToUse = isEndOfDay ? '23:59:59' : '00:00:00'
      } else if (timeToUse.length === 5) {
        timeToUse += isEndOfDay ? ':59' : ':00'
      }
      
      const dateTimeString = `${date}T${timeToUse}`
      const dateTime = new Date(dateTimeString)
      
      if (isNaN(dateTime.getTime())) {
        console.error('Invalid date:', dateTimeString)
        return null
      }
      
      const usTime = dateTime.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      
      const pakistanTime = dateTime.toLocaleString('en-US', {
        timeZone: 'Asia/Karachi', 
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      
      return `${usTime} (Pakistan: ${pakistanTime})`
    }
    catch (error) {
      console.error('Error formatting date for API:', error, { date, time })
      return null
    }
  }

  // Helper function to build API params
  const buildApiParams = (includeOutcomes = true) => {
    const params = new URLSearchParams()

    if (filters.search) {
      params.append('search', filters.search)
    }

    // Add date range filters with proper timezone handling
    if (filters.startDate) {
      const formattedStartDate = formatDateForAPI(filters.startDate, filters.startTime, false)
      if (formattedStartDate) {
        params.append('start_date', formattedStartDate)
      }
    }

    if (filters.endDate) {
      const formattedEndDate = formatDateForAPI(filters.endDate, filters.endTime, true)
      if (formattedEndDate) {
        params.append('end_date', formattedEndDate)
      }
    }

    // Add outcome filters (only for calls, not for outcome counts)
    if (includeOutcomes && filters.selectedOutcomes.length > 0) {
      filters.selectedOutcomes.forEach(outcome => {
        params.append('response_categories', outcome)
      })
    }

    // Add client_id filter for non-admin users
    if (userType === 'client' && user?.id) {
      params.append('client_id', user.id.toString())
    }

    return params
  }

  const fetchCalls = async () => {
    setLoading(true)
    try {
      const params = buildApiParams(true)
      params.append('page', pagination.page.toString())
      params.append('limit', pagination.limit.toString())

      console.log('Fetching calls with params:', params.toString())

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

  const fetchOutcomeCounts = async () => {
    try {
      const params = buildApiParams(false)
      const response = await fetch(`/api/outcome-counts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch outcome counts')

      const data = await response.json()
      setOutcomeCounts(data)
    } catch (error) {
      console.error('Error fetching outcome counts:', error)
    }
  }

  const handleFilterChange = (key: keyof FilterState, value: string | string[]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const resetFilters = () => {
    setFilters({
      search: "",
      startDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      selectedOutcomes: [],
    })
    setPagination(prev => ({ ...prev, page: 1 }))
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

  const handleOutcomeToggle = (outcomeId: string, checked: boolean) => {
    setFilters(prev => ({
      ...prev,
      selectedOutcomes: checked 
        ? [...prev.selectedOutcomes, outcomeId]
        : prev.selectedOutcomes.filter(id => id !== outcomeId)
    }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  if (!user || !userType) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Filter Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search & Filter Calls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Reset Row */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by phone number, response category, or List ID..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button onClick={resetFilters} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>

              {/* Date Range Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <Input
                    type="time"
                    value={filters.startTime}
                    onChange={(e) => handleFilterChange('startTime', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <Input
                    type="time"
                    value={filters.endTime}
                    onChange={(e) => handleFilterChange('endTime', e.target.value)}
                  />
                </div>
              </div>

              {/* Outcomes Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Call Outcomes
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {callOutcomes.map((outcome) => (
                    <div key={outcome.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={outcome.id}
                        checked={filters.selectedOutcomes.includes(outcome.id)}
                        onCheckedChange={(checked) => 
                          handleOutcomeToggle(outcome.id, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={outcome.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
                      >
                        <outcome.icon className={`h-3 w-3 ${outcome.iconColor}`} />
                        {outcome.title}
                        {outcomeCounts[outcome.id] && (
                          <span className="text-xs text-gray-500">
                            ({outcomeCounts[outcome.id]})
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Call Records ({pagination.total} total)
                </CardTitle>
                <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAKISTAN">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Pakistan Time
                      </div>
                    </SelectItem>
                    <SelectItem value="USA">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        US Eastern
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
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
                          <th className="text-left py-3 px-4 font-medium text-gray-700">List ID</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Response Category</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">
                            Timestamp ({selectedTimezone === 'USA' ? 'US Eastern' : 'Pakistan'})
                          </th>
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
        </main>
        
        <Toaster />
      </div>
    </AuthWrapper>
  )
}
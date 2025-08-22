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
    selectedOutcomes: []
  })

  const [calls, setCalls] = useState<Call[]>([])
  const [stats, setStats] = useState<CallStats>({
    totalCalls: 0,
    callsForwarded: 0,
    callsDropped: 0,
    categories: []
  })
  const [outcomeCounts, setOutcomeCounts] = useState<OutcomeCounts>({})
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [selectedTimezone, setSelectedTimezone] = useState<TimezoneKey>('USA') // Default to US timezone since data is in US time
  const [selectAll, setSelectAll] = useState(false)
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

  // Helper function to format date for API (converts to US timezone since database stores US time)
  const formatDateForAPI = (dateString: string, timeString: string = "", isEndDate = false) => {
    if (!dateString) return null
    
    // Parse inputs
    const [year, month, day] = dateString.split('-').map(Number)
    let hours = 0, minutes = 0
    
    if (timeString) {
      [hours, minutes] = timeString.split(':').map(Number)
    } else {
      if (isEndDate) {
        hours = 23
        minutes = 59
      }
    }
    
    if (selectedTimezone === 'PAKISTAN') {
      // User input is Pakistan time - convert to US time for database query
      // Pakistan is typically 9-10 hours ahead of US Eastern
      
      // Determine if US is in DST (EDT) or Standard Time (EST)
      const testDate = new Date(year, month - 1, day)
      const isDST = testDate.getMonth() >= 2 && testDate.getMonth() <= 10 // March to November
      const hoursOffset = isDST ? 9 : 10 // Pakistan is 9 hours ahead during EDT, 10 hours during EST
      
      // Convert Pakistan time to US time
      const pakistanDateTime = new Date(year, month - 1, day, hours, minutes, isEndDate ? 59 : 0)
      const usDateTime = new Date(pakistanDateTime.getTime() - (hoursOffset * 60 * 60 * 1000))
      
      // Format as string that represents US time (what database expects)
      return usDateTime.toISOString()
      
    } else {
      // User input is US time - send directly since database stores US time
      const usDateTime = new Date(year, month - 1, day, hours, minutes, isEndDate ? 59 : 0)
      return usDateTime.toISOString()
    }
  }

  // Helper function to format timestamp for display in selected timezone
  const formatTimestampForDisplay = (timestamp: string) => {
    // Database timestamp is in US timezone
    const usDate = new Date(timestamp)
    
    if (selectedTimezone === 'PAKISTAN') {
      // Convert US time to Pakistan time for display
      // Pakistan is typically 9-10 hours ahead of US Eastern
      
      // Determine if US is in DST at the time of this timestamp
      const isDST = usDate.getMonth() >= 2 && usDate.getMonth() <= 10 // March to November
      const hoursOffset = isDST ? 9 : 10 // Pakistan is 9 hours ahead during EDT, 10 hours during EST
      
      // Add the offset to get Pakistan time
      const pakistanDate = new Date(usDate.getTime() + (hoursOffset * 60 * 60 * 1000))
      
      return pakistanDate.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }) + ' PKT'
      
    } else {
      // Display US time as-is (since database stores US time)
      return usDate.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }) + ' EST/EDT'
    }
  }

  // Helper function to get current time in selected timezone
  const getCurrentTimeInTimezone = () => {
    const now = new Date()
    
    if (selectedTimezone === 'PAKISTAN') {
      // Show Pakistan time
      const pakistanTime = now.toLocaleString('en-US', {
        timeZone: 'Asia/Karachi',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
      
      // Also show corresponding US time for reference
      const usTime = now.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
      
      return `${pakistanTime} (US Eastern: ${usTime})`
      
    } else {
      // Show US time
      const usTime = now.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
      
      // Also show corresponding Pakistan time for reference
      const pakistanTime = now.toLocaleString('en-US', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
      
      return `${usTime} (Pakistan: ${pakistanTime})`
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

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const params = buildApiParams(false) // Don't include outcome filters for stats

      console.log('Fetching stats with params:', params.toString())

      const response = await fetch(`/api/calls/stats?${params}`)
      if (!response.ok) throw new Error('Failed to fetch stats')

      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchOutcomeCounts = async () => {
    try {
      const params = buildApiParams(false) // Don't include outcome filters for counts

      console.log('Fetching outcome counts with params:', params.toString())

      const response = await fetch(`/api/calls/outcome-counts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch outcome counts')

      const data = await response.json()
      setOutcomeCounts(data)
    } catch (error) {
      console.error('Error fetching outcome counts:', error)
    }
  }

  useEffect(() => {
    // Only fetch data after we have user info
    if (userType) {
      fetchCalls()
      fetchStats()
      fetchOutcomeCounts()
    }
  }, [pagination.page, filters, userType, user, selectedTimezone])

  // Update selectAll state when selectedOutcomes changes
  useEffect(() => {
    setSelectAll(filters.selectedOutcomes.length === callOutcomes.length)
  }, [filters.selectedOutcomes])

  const handleReset = () => {
    setFilters({
      search: "",
      startDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      selectedOutcomes: []
    })
    setSelectAll(false)
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleOutcomeChange = (outcomeId: string, checked: boolean) => {
    let updatedOutcomes: string[]

    if (checked) {
      updatedOutcomes = [...filters.selectedOutcomes, outcomeId]
    } else {
      updatedOutcomes = filters.selectedOutcomes.filter((id) => id !== outcomeId)
    }

    setFilters({
      ...filters,
      selectedOutcomes: updatedOutcomes
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setFilters({
        ...filters,
        selectedOutcomes: callOutcomes.map((outcome) => outcome.id)
      })
    } else {
      setFilters({
        ...filters,
        selectedOutcomes: []
      })
    }
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleRemoveFilter = (outcomeToRemove: string) => {
    const updatedOutcomes = filters.selectedOutcomes.filter(outcome => outcome !== outcomeToRemove)
    setFilters({
      ...filters,
      selectedOutcomes: updatedOutcomes
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleClearAllFilters = () => {
    setFilters({
      ...filters,
      selectedOutcomes: []
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const getOutcomeDisplayName = (outcome: string) => {
    const outcomeMap: { [key: string]: string } = {
      'answering-machine': 'Answering Machine',
      'interested': 'Interested',
      'not-interested': 'Not Interested',
      'do-not-call': 'Do Not Call',
      'do-not-qualify': 'Do Not Qualify',
      'unknown': 'Unknown'
    }
    return outcomeMap[outcome] || outcome
  }

  const getCategoryColor = (category: string) => {
    if (category.toLowerCase().includes('interested')) return "bg-green-500"
    if (category.toLowerCase().includes('answering')) return "bg-blue-500"
    if (category.toLowerCase().includes('unknown')) return "bg-gray-500"
    if (category.toLowerCase().includes('dnc')) return "bg-red-500"
    if (category.toLowerCase().includes('dnq')) return "bg-yellow-500"
    if (category.toLowerCase().includes('not_interested')) return "bg-red-400"
    return "bg-purple-500"
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const getPercentage = (value: number, total: number) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
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

  const statsCards = [
    {
      title: "Total Calls",
      value: formatNumber(stats.totalCalls),
      subtitle: userType === 'client' ? "Your total interactions" : "All recorded interactions",
      icon: Phone,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      title: "Calls Forwarded",
      value: formatNumber(stats.callsForwarded),
      subtitle: `${getPercentage(stats.callsForwarded, stats.totalCalls)}% of total calls`,
      icon: PhoneForwarded,
      color: "text-green-500",
      bgColor: "bg-green-50",
    },
    {
      title: "Calls Dropped",
      value: formatNumber(stats.callsDropped),
      subtitle: `${getPercentage(stats.callsDropped, stats.totalCalls)}% of total calls`,
      icon: PhoneOff,
      color: "text-red-500",
      bgColor: "bg-red-50",
    },
  ]

  return (
    <AuthWrapper requiredRole="client">
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />

        <div className="container mx-auto px-6 py-6">
          {/* Filter Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Filter Calls</h2>
                {userType === 'client' && user?.name && (
                  <p className="text-sm text-gray-500 mt-1">
                    Filtering your call records
                  </p>
                )}
              </div>
              
              {/* Timezone Selector */}
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Timezone:</span>
                <Select value={selectedTimezone} onValueChange={(value: TimezoneKey) => setSelectedTimezone(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USA">🇺🇸 USA (Eastern)</SelectItem>
                    <SelectItem value="PAKISTAN">🇵🇰 Pakistan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Current Time Display */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-sm text-gray-700">
                <strong>Current Time ({selectedTimezone === 'USA' ? 'US Eastern' : 'Pakistan'}):</strong> {getCurrentTimeInTimezone()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Database stores timestamps in US timezone. {selectedTimezone === 'PAKISTAN' 
                  ? 'Your Pakistan time inputs are converted to US time for database queries, and results are converted back to Pakistan time for display.' 
                  : 'Your US time inputs match the database timezone directly.'}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Date Range</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      className="w-40"
                      placeholder="Start Date"
                      value={filters.startDate}
                      onChange={(e) => {
                        setFilters({ ...filters, startDate: e.target.value })
                        setPagination(prev => ({ ...prev, page: 1 }))
                      }}
                    />
                    <span className="text-sm text-gray-500">to</span>
                    <Input
                      type="date"
                      className="w-40"
                      placeholder="End Date"
                      value={filters.endDate}
                      onChange={(e) => {
                        setFilters({ ...filters, endDate: e.target.value })
                        setPagination(prev => ({ ...prev, page: 1 }))
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Time Range (Optional)</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      className="w-32"
                      placeholder="Start Time"
                      value={filters.startTime}
                      onChange={(e) => {
                        setFilters({ ...filters, startTime: e.target.value })
                        setPagination(prev => ({ ...prev, page: 1 }))
                      }}
                    />
                    <span className="text-sm text-gray-500">to</span>
                    <Input
                      type="time"
                      className="w-32"
                      placeholder="End Time"
                      value={filters.endTime}
                      onChange={(e) => {
                        setFilters({ ...filters, endTime: e.target.value })
                        setPagination(prev => ({ ...prev, page: 1 }))
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </div>

              {/* Show current filter status */}
              {(filters.startDate || filters.endDate || filters.startTime || filters.endTime) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm text-blue-900">
                    <strong>Date Filter ({selectedTimezone === 'USA' ? 'US Eastern' : 'Pakistan'} Time):</strong>
                    {filters.startDate && ` From ${new Date(filters.startDate).toLocaleDateString()}`}
                    {filters.startTime && ` at ${filters.startTime}`}
                    {filters.endDate && ` To ${new Date(filters.endDate).toLocaleDateString()}`}
                    {filters.endTime && ` at ${filters.endTime}`}
                    {!filters.startDate && filters.endDate && ` Up to ${new Date(filters.endDate).toLocaleDateString()}`}
                    {filters.startDate && !filters.endDate && ` From ${new Date(filters.startDate).toLocaleDateString()} onwards`}
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    {selectedTimezone === 'PAKISTAN' 
                      ? 'Pakistan time inputs are converted to US time for database queries (database stores US timezone)'
                      : 'US time inputs match database timezone directly (no conversion needed)'
                    }
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Debug Component - Remove this after fixing the issue */}
          <DebugFilter filters={filters} selectedTimezone={selectedTimezone} />

          <div className="space-y-6 mt-6">
            {/* Stats Cards */}
            <div className="space-y-4">
              {userType === 'client' && user?.name && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-900">Dashboard for {user.name}</h3>
                  <p className="text-xs text-blue-700 mt-1">Extension: {user.extension}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {statsCards.map((stat) => (
                  <Card key={stat.title} className="relative overflow-hidden">
                    <CardContent className="p-6">
                      {statsLoading ? (
                        <div className="animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                            <p className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</p>
                            <p className="text-sm text-gray-500">{stat.subtitle}</p>
                          </div>
                          <div className={`p-3 rounded-full ${stat.bgColor}`}>
                            <stat.icon className={`h-6 w-6 ${stat.color}`} />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Call Records with Filters */}
            <div className="flex gap-6">
              <div className="flex-1 space-y-4">
                {/* Active Filters Display */}
                {filters.selectedOutcomes.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-blue-900">Active Filters:</span>
                      {filters.selectedOutcomes.map((outcome) => (
                        <Badge
                          key={outcome}
                          variant="secondary"
                          className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer"
                          onClick={() => handleRemoveFilter(outcome)}
                        >
                          {getOutcomeDisplayName(outcome)} ({outcomeCounts[outcome] || 0})
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-800 ml-2"
                        onClick={handleClearAllFilters}
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>
                )}

                {/* Call Records Table */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold">Call Records</CardTitle>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search phone numbers..."
                            className="pl-10 w-64"
                            value={filters.search}
                            onChange={(e) => {
                              setFilters({ ...filters, search: e.target.value })
                              setPagination(prev => ({ ...prev, page: 1 }))
                            }}
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
                                <th className="text-left py-3 px-4 font-medium text-gray-700">Phone No</th>
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
                                  <td className="py-3 px-4 text-sm text-gray-900">{call.phone_number}</td>
                                  <td className="py-3 px-4">
                                    <Badge className={`${getCategoryColor(call.response_category)} text-white`}>
                                      {call.response_category}
                                    </Badge>
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-600">{formatTimestampForDisplay(call.timestamp)}</td>
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
                              No call records found.
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
              </div>

              {/* Call Outcomes Filter */}
              <Card className="w-80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-700">Call Outcomes</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all"
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                    />
                    <label htmlFor="select-all" className="text-xs text-gray-600 cursor-pointer">
                      Select All
                    </label>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {callOutcomes.map((outcome) => (
                    <div key={outcome.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={outcome.id}
                          checked={filters.selectedOutcomes.includes(outcome.id)}
                          onCheckedChange={(checked) => handleOutcomeChange(outcome.id, checked as boolean)}
                        />
                        <div className="flex items-center gap-2">
                          <outcome.icon className={`h-3 w-3 ${outcome.iconColor}`} />
                          <label htmlFor={outcome.id} className="text-xs font-medium text-gray-700 cursor-pointer">
                            {outcome.title}
                          </label>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {outcomeCounts[outcome.id] || 0}
                      </Badge>
                    </div>
                  ))}

                  <div className="pt-3 border-t">
                    <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white" size="sm">
                      Apply Filters
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <Toaster />
      </div>
    </AuthWrapper>
  )
}
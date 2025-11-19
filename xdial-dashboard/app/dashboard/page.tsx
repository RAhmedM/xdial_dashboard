// app/dashboard/page.tsx
"use client"

import { useState, useEffect } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { AuthWrapper } from "@/components/auth-wrapper"
import { Toaster } from "@/components/ui/toaster"
import { TranscriptPopup } from "@/components/transcript-popup"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Shield,
  MicOff,
  VolumeX,
  Circle,
  PhoneOff,
  Minus,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getUserFromStorage, getUserTypeFromStorage, setUserInStorage } from "@/lib/utils"
import { CategoryChangeCards } from "@/components/category-change-cards"

interface FilterState {
  search: string
  listIdSearch: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  selectedOutcomes: string[]
}

interface Call {
  call_id: number
  client_id: number
  phone_number: string
  response_category: string
  timestamp: string
  recording_url: string
  recording_length: number
  list_id: string | null
  final_transcription: string | null
  client_name: string
}

interface User {
  id?: number
  username?: string
  role?: string
  name?: string
  extension?: string
}

interface OutcomeCounts {
  [key: string]: number
}

type SortField = 'call_id' | 'phone_number' | 'list_id' | 'response_category' | 'timestamp' | 'client_name'
type SortDirection = 'asc' | 'desc'

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
  {
    id: "Honeypot",
    title: "Honeypot",
    icon: Shield,
    iconColor: "text-purple-500",
  },
  {
    id: "User_Silent",
    title: "User Silent",
    icon: MicOff,
    iconColor: "text-slate-500",
  },
  {
    id: "INAUDIBLE",
    title: "INAUDIBLE",
    icon: VolumeX,
    iconColor: "text-orange-500",
  },
  {
    id: "neutral",
    title: "Neutral",
    icon: Circle,
    iconColor: "text-gray-400",
  },
  {
    id: "NA",
    title: "NA",
    icon: Minus,
    iconColor: "text-gray-600",
  },
  {
    id: "USER-HUNGUP",
    title: "User Hung Up",
    icon: PhoneOff,
    iconColor: "text-red-600",
  },
]

// Get today's date in YYYY-MM-DD format
const getTodaysDate = () => {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    listIdSearch: "",
    startDate: getTodaysDate(),
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
  const [outcomeCounts, setOutcomeCounts] = useState<OutcomeCounts>({})
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectAllOutcomes, setSelectAllOutcomes] = useState(false)
  
  const [categoryChanges, setCategoryChanges] = useState<{
    fiveMin: OutcomeCounts
    tenMin: OutcomeCounts
  }>({
    fiveMin: {},
    tenMin: {}
  })
  
  const [transcriptPopup, setTranscriptPopup] = useState<{
    isOpen: boolean
    transcript: string | null
    callId: number
    phoneNumber: string
    responseCategory: string
    timestamp: string
    clientName: string
    listId: string | null
  }>({
    isOpen: false,
    transcript: null,
    callId: 0,
    phoneNumber: '',
    responseCategory: '',
    timestamp: '',
    clientName: '',
    listId: null
  })

  const { toast } = useToast()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = getUserFromStorage()
      const storedUserType = getUserTypeFromStorage()
      
      if (storedUser) {
        setUser(storedUser)
      }
      if (storedUserType) {
        setUserType(storedUserType)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const tempAuthKey = urlParams.get('tempAuth')
      
      if (tempAuthKey) {
        const authDataStr = localStorage.getItem(tempAuthKey)
        
        if (authDataStr) {
          try {
            const authData = JSON.parse(authDataStr)
            const { user: authUser, userType: authUserType } = authData
            
            setUserInStorage(authUser, authUserType)
            
            setUser(authUser)
            setUserType(authUserType)

            localStorage.removeItem(tempAuthKey)
            
            const newUrl = window.location.pathname
            window.history.replaceState({}, '', newUrl)

            toast({
              title: "Login Successful",
              description: `Logged in as ${authUser.name || authUser.username}`
            })
          } catch (error) {
            console.error('Error parsing auth data:', error)
            localStorage.removeItem(tempAuthKey)
          }
        }
      }
    }
  }, [toast])

  useEffect(() => {
    if (user && userType) {
      fetchCalls()
      fetchOutcomeCounts()
      fetchCategoryChanges()
    }
  }, [filters, pagination.page, pagination.limit, sortField, sortDirection, user, userType])

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'N/A'
    
    try {
      const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]+(\d{2}):(\d{2}):(\d{2})/)
      
      if (match) {
        const [, year, month, day, hours, minutes, seconds] = match
        return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds}`
      }
      
      console.warn('Unexpected timestamp format:', timestamp)
      return timestamp
    } catch (error) {
      console.error('Error formatting timestamp:', error)
      return timestamp
    }
  }

  const buildApiParams = (includeOutcomes = true) => {
    const params = new URLSearchParams()

    if (filters.search) {
      params.append('search', filters.search)
    }

    if (filters.listIdSearch) {
      params.append('list_id_search', filters.listIdSearch)
    }

    if (filters.startDate) {
      const startDateTime = filters.startTime 
        ? `${filters.startDate}T${filters.startTime}:00`
        : `${filters.startDate}T00:00:00`
      params.append('start_date', startDateTime)
    }

    if (filters.endDate) {
      const endDateTime = filters.endTime 
        ? `${filters.endDate}T${filters.endTime}:59`
        : `${filters.endDate}T23:59:59`
      params.append('end_date', endDateTime)
    }

    if (includeOutcomes && filters.selectedOutcomes.length > 0) {
      filters.selectedOutcomes.forEach(outcome => {
        params.append('response_categories', outcome)
      })
    }

    if (userType === 'client' && user?.id) {
      params.append('client_id', user.id.toString())
    }

    params.append('sort_field', sortField)
    params.append('sort_direction', sortDirection)

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
      console.log('Fetching outcome counts with params:', params.toString())
      const response = await fetch(`/api/calls/outcome-counts?${params}`)
      
      console.log('Outcome counts response status:', response.status)
      console.log('Outcome counts response ok:', response.ok)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Outcome counts API error:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        })
        console.error('Full error response:', errorText)
        console.warn('Setting empty outcome counts due to API error')
        setOutcomeCounts({})
        return
      }

      const data = await response.json()
      console.log('Outcome counts data received:', data)
      setOutcomeCounts(data)
    } catch (error) {
      console.error('Error fetching outcome counts:', error)
    }
  }

  const fetchCategoryChanges = async () => {
    try {
      const params = buildApiParams(false)
      
      const fiveMinResponse = await fetch(`/api/calls/category-changes?${params}&interval=5`)
      const fiveMinData = await fiveMinResponse.ok ? await fiveMinResponse.json() : {}
      
      const tenMinResponse = await fetch(`/api/calls/category-changes?${params}&interval=10`)
      const tenMinData = await tenMinResponse.ok ? await tenMinResponse.json() : {}
      
      setCategoryChanges({
        fiveMin: fiveMinData,
        tenMin: tenMinData
      })
    } catch (error) {
      console.error('Error fetching category changes:', error)
    }
  }

  const handleFilterChange = (key: keyof FilterState, value: string | string[]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const resetFilters = () => {
    setFilters({
      search: "",
      listIdSearch: "",
      startDate: getTodaysDate(),
      endDate: "",
      startTime: "",
      endTime: "",
      selectedOutcomes: [],
    })
    setPagination(prev => ({ ...prev, page: 1 }))
    setSelectAllOutcomes(false)
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

  const handleViewTranscript = (call: Call) => {
    setTranscriptPopup({
      isOpen: true,
      transcript: call.final_transcription,
      callId: call.call_id,
      phoneNumber: call.phone_number,
      responseCategory: call.response_category,
      timestamp: call.timestamp,
      clientName: call.client_name,
      listId: call.list_id
    })
  }

  const handleCloseTranscript = () => {
    setTranscriptPopup({
      isOpen: false,
      transcript: null,
      callId: 0,
      phoneNumber: '',
      responseCategory: '',
      timestamp: '',
      clientName: '',
      listId: null
    })
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
      case 'honeypot':
        return 'bg-purple-500'
      case 'user_silent':
        return 'bg-slate-500'
      case 'inaudible':
        return 'bg-orange-500'
      case 'neutral':
        return 'bg-gray-400'
      case 'na':
        return 'bg-gray-600'
      case 'user-hungup':
        return 'bg-red-600'
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

  const handleSelectAllOutcomes = (checked: boolean) => {
    setSelectAllOutcomes(checked)
    if (checked) {
      const allOutcomes = callOutcomes.map(outcome => outcome.id)
      setFilters(prev => ({
        ...prev,
        selectedOutcomes: allOutcomes
      }))
    } else {
      setFilters(prev => ({
        ...prev,
        selectedOutcomes: []
      }))
    }
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 text-gray-400" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1 text-blue-500" />
      : <ArrowDown className="h-4 w-4 ml-1 text-blue-500" />
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
              <p className="text-sm text-gray-600 mt-2">
                All times are displayed in US Eastern Time (EST/EDT)
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Reset Row */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by phone number, response category..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Search by List ID..."
                    value={filters.listIdSearch}
                    onChange={(e) => handleFilterChange('listIdSearch', e.target.value)}
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
                    Start Date (US EST/EDT)
                  </label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time (US EST/EDT)
                  </label>
                  <Input
                    type="time"
                    value={filters.startTime}
                    onChange={(e) => handleFilterChange('startTime', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date (US EST/EDT)
                  </label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time (US EST/EDT)
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
                
                {/* Select All Checkbox */}
                <div className="mb-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all"
                      checked={selectAllOutcomes}
                      onCheckedChange={(checked) => 
                        handleSelectAllOutcomes(checked as boolean)
                      }
                    />
                    <label
                      htmlFor="select-all"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Select All
                    </label>
                  </div>
                </div>

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
                        <span>{outcome.title}</span>
                        {outcomeCounts[outcome.id] !== undefined && (
                          <span className="text-xs text-gray-500">
                            ({outcomeCounts[outcome.id] || 0})
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <CategoryChangeCards fiveMinChanges={categoryChanges.fiveMin} tenMinChanges={categoryChanges.tenMin}></CategoryChangeCards>

          

          {/* Results Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Call Records ({pagination.total} total)
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                All times are displayed in US Eastern Time (EST/EDT)
              </p>
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
                          <th 
                            className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                            onClick={() => handleSort('call_id')}
                          >
                            <div className="flex items-center">
                              #
                              {getSortIcon('call_id')}
                            </div>
                          </th>
                          {userType === 'admin' && (
                            <th 
                              className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                              onClick={() => handleSort('client_name')}
                            >
                              <div className="flex items-center">
                                Client
                                {getSortIcon('client_name')}
                              </div>
                            </th>
                          )}
                          <th 
                            className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                            onClick={() => handleSort('phone_number')}
                          >
                            <div className="flex items-center">
                              Phone No
                              {getSortIcon('phone_number')}
                            </div>
                          </th>
                          <th 
                            className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                            onClick={() => handleSort('list_id')}
                          >
                            <div className="flex items-center">
                              List ID
                              {getSortIcon('list_id')}
                            </div>
                          </th>
                          <th 
                            className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                            onClick={() => handleSort('response_category')}
                          >
                            <div className="flex items-center">
                              Response Category
                              {getSortIcon('response_category')}
                            </div>
                          </th>
                          <th 
                            className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                            onClick={() => handleSort('timestamp')}
                          >
                            <div className="flex items-center">
                              Timestamp (US EST/EDT)
                              {getSortIcon('timestamp')}
                            </div>
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Transcript</th>
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
                                onClick={() => handleViewTranscript(call)}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex items-center gap-2"
                              >
                                <FileText className="h-4 w-4" />
                                {call.final_transcription ? 'View Transcript' : 'No Transcript'}
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
        <TranscriptPopup
          isOpen={transcriptPopup.isOpen}
          onClose={handleCloseTranscript}
          transcript={transcriptPopup.transcript}
          callId={transcriptPopup.callId}
          phoneNumber={transcriptPopup.phoneNumber}
          responseCategory={transcriptPopup.responseCategory}
          timestamp={transcriptPopup.timestamp}
          clientName={transcriptPopup.clientName}
          listId={transcriptPopup.listId}
        />
      </div>
    </AuthWrapper>
  )
}
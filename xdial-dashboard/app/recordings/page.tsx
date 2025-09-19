// Get user info on component mount
  useEffect(() => {'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileAudio, Play, Pause, Download, Search, Calendar, AlertTriangle, RefreshCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard-header'

interface Recording {
  id: string
  unique_id: string
  timestamp: string
  duration: string
  phone_number: string
  original_url?: string
  response_category: string
  speech_text: string
  audio_url: string
  size?: string
  call_id?: string
  database_category?: string
  filename?: string
}

interface User {
  id: number
  username: string
  role: string
  name: string
  extension?: string
}

interface ApiResponse {
  recordings: Recording[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
  client_id?: string
  client_name?: string
  extension?: string
  date?: string
  search?: string
  warning?: string
  source?: string
  cached?: boolean
  error?: string
}

type SortField = 'timestamp' | 'phone_number' | 'duration' | 'response_category' | 'size'
type SortDirection = 'asc' | 'desc'

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [searchTerm, setSearchTerm] = useState("")
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalRecordings, setTotalRecordings] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPrevPage, setHasPrevPage] = useState(false)
  const [dataSource, setDataSource] = useState<'cache' | 'fresh' | null>(null)

  // Debounce state to prevent multiple rapid API calls
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  // Track previous selected date to detect changes
  const prevSelectedDate = useRef(selectedDate)

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
  }, [])
    if (typeof window !== 'undefined') {
      const storedUser = sessionStorage.getItem('user')
      const storedUserType = sessionStorage.getItem('userType')
      
      console.log('Raw sessionStorage data:')
      console.log('user:', storedUser)
      console.log('userType:', storedUserType)
      
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser)
        console.log('Parsed user object:', parsedUser)
        setUser(parsedUser)
        
        // Debug API call (only in development)
        if (process.env.NODE_ENV === 'development') {
          fetch('/api/debug/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user: parsedUser,
              userType: storedUserType,
              rawSession: {
                user: storedUser,
                userType: storedUserType
              }
            })
          }).catch(err => console.log('Debug API call failed:', err))
        }
      }
      if (storedUserType) {
        setUserType(storedUserType)
      }
    }
  }, [])

  // Reset to first page when filters or sorting change
  useEffect(() => {
    console.log('Reset to page 1 triggered by:', { selectedDate, searchTerm, pageSize, sortField, sortDirection })
    setCurrentPage(1)
    
    // Clear any pending debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      setDebounceTimer(null)
    }
  }, [selectedDate, searchTerm, pageSize, sortField, sortDirection])

  // Fetch recordings
  const fetchRecordings = async (page = currentPage, forceRefresh = false) => {
    // Try to get client ID from different possible fields
    let clientId = user?.id || user?.client_id
    
    // Fallback: if user has username and it's a number, use that as client_id
    if (!clientId && user?.username && !isNaN(parseInt(user.username))) {
      clientId = parseInt(user.username)
      console.log('Using username as client_id fallback:', clientId)
    }
    
    console.log('Recordings fetch attempt:', { 
      user, 
      userType, 
      clientId, 
      selectedDate,
      page,
      pageSize,
      searchTerm,
      'user.id': user?.id,
      'user.client_id': user?.client_id,
      'user.username': user?.username
    })
    
    if (!clientId) {
      console.log('No client ID found, not fetching recordings')
      setError('Client ID not found. Please log out and log in again.')
      setLoading(false)
      return
    }

    console.log('Starting recordings fetch...')
    setLoading(true)
    setError(null)
    setWarning(null)
    
    try {
      const params = new URLSearchParams({
        client_id: clientId.toString(),
        date: selectedDate,
        page: page.toString(),
        limit: pageSize.toString(),
        sortField: sortField,
        sortDirection: sortDirection
      })
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim())
      }
      
      if (forceRefresh) {
        params.append('refresh', 'true')
      }
      
      const url = `/api/recordings?${params.toString()}`
      console.log('Fetching recordings from:', url)
      
      const response = await fetch(url)
      
      const data: ApiResponse = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch recordings')
      }
      
      console.log('Recordings received:', data)
      
      setRecordings(data.recordings || [])
      setTotalRecordings(data.total || 0)
      setTotalPages(data.totalPages || 0)
      setHasNextPage(data.hasNextPage || false)
      setHasPrevPage(data.hasPrevPage || false)
      setCurrentPage(data.page || 1)
      setDataSource(data.cached ? 'cache' : 'fresh')
      
      // Show warning if there's one
      if (data.warning) {
        setWarning(data.warning)
      }
      
    } catch (error) {
      console.error('Error fetching recordings:', error)
      setError(error instanceof Error ? error.message : 'Failed to load recordings')
      setRecordings([])
      setTotalRecordings(0)
      setTotalPages(0)
      setHasNextPage(false)
      setHasPrevPage(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Try to get client ID from different possible fields
    let clientId = user?.id || user?.client_id
    
    // Fallback: if user has username and it's a number, use that as client_id
    if (!clientId && user?.username && !isNaN(parseInt(user.username))) {
      clientId = parseInt(user.username)
    }
    
    console.log('Main useEffect triggered:', { 
      user: !!user, 
      userType, 
      clientId,
      currentPage,
      selectedDate,
      sortField,
      sortDirection,
      searchTerm,
      'user.id': user?.id,
      'user.client_id': user?.client_id,
      'user.username': user?.username
    })
    
    // Clear any existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    
    if (clientId && userType === 'client') {
      // Force refresh when date changes, but not on page/sort changes
      const shouldForceRefresh = prevSelectedDate.current !== selectedDate
      if (shouldForceRefresh) {
        prevSelectedDate.current = selectedDate
      }
      
      // Debounce the API call to prevent rapid successive calls
      const timer = setTimeout(() => {
        console.log('Executing debounced fetch with:', { currentPage, shouldForceRefresh })
        fetchRecordings(currentPage, shouldForceRefresh)
      }, 100) // 100ms debounce
      
      setDebounceTimer(timer)
      
      // Cleanup function
      return () => {
        clearTimeout(timer)
      }
    } else if (userType === 'admin') {
      // Admin users shouldn't access recordings directly
      setError('Admin users cannot access recordings directly. Please use client login.')
      setLoading(false)
    } else {
      console.log('No client ID available or not a client user, setting loading to false')
      setError('Client ID not found. Please ensure you are logged in as a client.')
      setLoading(false)
    }
  }, [user, userType, selectedDate, currentPage, pageSize, searchTerm, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    console.log('Sort clicked:', { field, currentSortField: sortField, currentSortDirection: sortDirection, currentPage })
    
    // Clear any existing debounce timer to prevent race conditions
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      setDebounceTimer(null)
    }
    
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
    
    // The page reset will be handled by the useEffect that watches sortField and sortDirection
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize))
    setCurrentPage(1) // Reset to first page when changing page size
  }

  const handleDownload = async (recording: Recording) => {
    try {
      // Use the proxy URL for download instead of the direct URL
      const downloadUrl = recording.audio_url
      
      if (!downloadUrl) {
        setError("No audio URL available for download")
        return
      }
      
      // Create a temporary anchor element for download
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = recording.filename || `recording_${recording.phone_number}_${recording.timestamp.replace(/[: ]/g, "-")}.wav`
      link.target = "_blank"
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Error downloading recording:", error)
      setError("Failed to download recording. Please try again.")
    }
  }

  const handlePlay = (recordingId: string) => {
    if (playingId === recordingId) {
      setPlayingId(null)
    } else {
      setPlayingId(recordingId)
    }
  }

  const formatDuration = (duration: string) => {
    // Handle duration in MM:SS:SS or HH:MM:SS format
    if (duration && duration.includes(':')) {
      return duration
    }
    // If it's just seconds
    const totalSeconds = parseInt(duration)
    if (isNaN(totalSeconds)) return duration || '00:00:00'
    
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleString()
    } catch (error) {
      return timestamp
    }
  }

  const getStatusBadgeColor = (category: string) => {
    switch (category.toUpperCase()) {
      case 'ANSWERED':
      case 'HUMAN':
        return 'bg-green-100 text-green-800'
      case 'VOICEMAIL':
      case 'ANSWERING_MACHINE':
        return 'bg-blue-100 text-blue-800'
      case 'NO_ANSWER':
      case 'BUSY':
        return 'bg-yellow-100 text-yellow-800'
      case 'FAILED':
      case 'ERROR':
        return 'bg-red-100 text-red-800'
      case 'EXTERNAL_RECORDING':
        return 'bg-purple-100 text-purple-800'
      case 'UNKNOWN':
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const SortableHeader = ({ field, children }: { field: SortField, children: React.ReactNode }) => (
    <th 
      className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? 
            <ChevronUp className="h-4 w-4" /> : 
            <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </th>
  )

  // Pagination component
  const PaginationControls = () => {
    const getPageNumbers = () => {
      const pages = []
      const maxVisible = 5
      
      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        const start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
        const end = Math.min(totalPages, start + maxVisible - 1)
        
        if (start > 1) {
          pages.push(1)
          if (start > 2) pages.push('...')
        }
        
        for (let i = start; i <= end; i++) {
          pages.push(i)
        }
        
        if (end < totalPages) {
          if (end < totalPages - 1) pages.push('...')
          pages.push(totalPages)
        }
      }
      
      return pages
    }

    if (totalPages <= 1) return null

    return (
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">
            Showing {recordings.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, totalRecordings)} of {totalRecordings} recordings
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(1)}
            disabled={!hasPrevPage}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!hasPrevPage}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex gap-1">
            {getPageNumbers().map((page, index) => (
              page === '...' ? (
                <span key={index} className="px-3 py-2 text-gray-500">...</span>
              ) : (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(page as number)}
                  className="min-w-[40px]"
                >
                  {page}
                </Button>
              )
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!hasNextPage}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(totalPages)}
            disabled={!hasNextPage}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileAudio className="h-6 w-6 text-blue-500" />
              Call Recordings
              {user?.extension && <span className="text-lg font-normal text-gray-600">- Extension {user.extension}</span>}
            </h1>
            <p className="text-gray-600 mt-1">
              Listen to and download your call recordings
            </p>
          </div>

          {/* Debug Info (temporary) */}
          {process.env.NODE_ENV === 'development' && (
            <Card className="mb-6 border-gray-200 bg-gray-50">
              <CardContent className="pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Debug Info:</h3>
                <div className="text-xs font-mono text-gray-600 space-y-1">
                  <div>User Type: {userType}</div>
                  <div>User ID: {user?.id || 'undefined'}</div>
                  <div>User Client ID: {user?.client_id || 'undefined'}</div>
                  <div>User Name: {user?.name || 'undefined'}</div>
                  <div>User Username: {user?.username || 'undefined'}</div>
                  <div>User Extension: {user?.extension || 'undefined'}</div>
                  <div>Current Page: {currentPage}</div>
                  <div>Page Size: {pageSize}</div>
                  <div>Total Records: {totalRecordings}</div>
                  <div>Total Pages: {totalPages}</div>
                  <div>Sort Field: {sortField}</div>
                  <div>Sort Direction: {sortDirection}</div>
                  <div>Data Source: {dataSource || 'unknown'}</div>
                  <div>Computed Client ID: {
                    user?.id || 
                    user?.client_id || 
                    (user?.username && !isNaN(parseInt(user.username)) ? parseInt(user.username) : null) ||
                    'none found'
                  }</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Access Control Notice for Admin */}
          {userType === 'admin' && (
            <Alert className="mb-6 border-blue-200 bg-blue-50">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Recordings are only available for client accounts. Please log in with a client account to access recordings.
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchRecordings(currentPage, true)}
                  className="ml-2 h-6 px-2"
                >
                  <RefreshCcw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Warning Alert */}
          {warning && (
            <Alert className="mb-6 border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                {warning}
              </AlertDescription>
            </Alert>
          )}

          {/* Only show filters and content for client users */}
          {userType === 'client' && (
            <>
              {/* Filters */}
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Date Picker */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Date
                      </label>
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full"
                      />
                    </div>

                    {/* Search */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Search className="h-4 w-4" />
                        Search
                      </label>
                      <Input
                        placeholder="Search phone number, category..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full"
                      />
                    </div>

                    {/* Page Size */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Records per page
                      </label>
                      <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25 per page</SelectItem>
                          <SelectItem value="50">50 per page</SelectItem>
                          <SelectItem value="100">100 per page</SelectItem>
                          <SelectItem value="200">200 per page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Refresh Button */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Actions
                      </label>
                      <Button 
                        onClick={() => fetchRecordings(currentPage, true)}
                        disabled={loading}
                        className="w-full"
                        variant="outline"
                      >
                        <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Results Summary */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-600">
                    {totalRecordings > 0 
                      ? `Found ${totalRecordings} recording${totalRecordings !== 1 ? 's' : ''}`
                      : 'No recordings found'
                    }
                    {selectedDate && ` for ${format(new Date(selectedDate), 'MMMM d, yyyy')}`}
                    {searchTerm && ` matching "${searchTerm}"`}
                  </p>
                  
                  {dataSource && (
                    <div className="flex items-center gap-1">
                      <div className={`h-2 w-2 rounded-full ${dataSource === 'cache' ? 'bg-blue-400' : 'bg-green-400'}`} />
                      <span className="text-xs text-gray-500">
                        {dataSource === 'cache' ? 'Cached data' : 'Fresh data'}
                      </span>
                    </div>
                  )}
                </div>
                
                {totalPages > 1 && (
                  <p className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </p>
                )}
              </div>

              {/* Recordings Table */}
              {loading ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                      <p className="text-gray-500">Loading recordings...</p>
                    </div>
                  </CardContent>
                </Card>
              ) : recordings.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <FileAudio className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No recordings found</h3>
                      <p className="text-gray-500">
                        {totalRecordings === 0 
                          ? "No recordings available for this date."
                          : "No recordings match your current filters."
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b border-gray-200 bg-gray-50">
                          <tr>
                            <SortableHeader field="timestamp">Time</SortableHeader>
                            <SortableHeader field="phone_number">Phone Number</SortableHeader>
                            <SortableHeader field="duration">Duration</SortableHeader>
                            <SortableHeader field="response_category">Category</SortableHeader>
                            <SortableHeader field="size">Size</SortableHeader>
                            <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recordings.map((recording) => (
                            <tr key={recording.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-4 text-sm text-gray-900">
                                {formatTimestamp(recording.timestamp)}
                              </td>
                              <td className="py-3 px-4 text-sm font-medium text-gray-900">
                                {recording.phone_number}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-900">
                                {formatDuration(recording.duration)}
                              </td>
                              <td className="py-3 px-4">
                                <Badge className={getStatusBadgeColor(recording.response_category)}>
                                  {recording.response_category}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-500">
                                {recording.size || '-'}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {/* Audio Player */}
                                  {recording.audio_url && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handlePlay(recording.id)}
                                      >
                                        {playingId === recording.id ? (
                                          <Pause className="h-4 w-4" />
                                        ) : (
                                          <Play className="h-4 w-4" />
                                        )}
                                      </Button>
                                      
                                      {playingId === recording.id && (
                                        <audio
                                          controls
                                          autoPlay
                                          className="w-32"
                                          onEnded={() => setPlayingId(null)}
                                        >
                                          <source src={recording.audio_url} type="audio/wav" />
                                          <source src={recording.audio_url} type="audio/mpeg" />
                                          Your browser does not support the audio element.
                                        </audio>
                                      )}
                                    </div>
                                  )}

                                  {/* Download Button */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDownload(recording)}
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination Controls */}
                    <div className="p-4 border-t border-gray-200">
                      <PaginationControls />
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileAudio, Play, Pause, Download, Search, Calendar, AlertTriangle, RefreshCcw, ChevronUp, ChevronDown } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard-header'

interface Recording {
  id: string
  unique_id: string
  timestamp: string
  duration: string
  phone_number: string
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
  client_id?: number
}

interface ApiResponse {
  recordings: Recording[]
  total: number
  client_name?: string
  date?: string
  warning?: string
  source?: string
  error?: string
}

type SortField = 'timestamp' | 'phone_number' | 'duration' | 'response_category' | 'size'
type SortDirection = 'asc' | 'desc'

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [filteredRecordings, setFilteredRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [searchTerm, setSearchTerm] = useState("")
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

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

  // Fetch recordings
  const fetchRecordings = async () => {
    // Try both client_id and id properties since they might be stored differently
    const clientId = user?.client_id || user?.id
    
    console.log('🎬 Recordings fetch attempt:', { 
      user, 
      userType, 
      clientId, 
      selectedDate 
    })
    
    if (!clientId) {
      console.log('❌ No client ID found, not fetching recordings')
      setLoading(false)
      return
    }

    console.log('🚀 Starting recordings fetch...')
    setLoading(true)
    setError(null)
    setWarning(null)
    
    try {
      const url = `/api/recordings?client_id=${clientId}&date=${selectedDate}`
      console.log('📞 Fetching recordings from:', url)
      
      const response = await fetch(url)
      
      const data: ApiResponse = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch recordings')
      }
      
      console.log('✅ Recordings received:', data)
      
      setRecordings(data.recordings || [])
      setFilteredRecordings(data.recordings || [])
      setClientName(data.client_name || '')
      
      // Show warning if there's one
      if (data.warning) {
        setWarning(data.warning)
      }
      
    } catch (error) {
      console.error('💥 Error fetching recordings:', error)
      setError(error instanceof Error ? error.message : 'Failed to load recordings')
      setRecordings([])
      setFilteredRecordings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const extension = user?.extension
    console.log('🔄 Recordings useEffect triggered:', { user, userType, extension })
    
    if (extension) {
      fetchRecordings()
    } else {
      console.log('⚠️ No extension available, setting loading to false')
      setLoading(false)
    }
  }, [user, selectedDate])

  // Filter and sort recordings
  useEffect(() => {
    let filtered = [...recordings]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(rec => 
        rec.phone_number.includes(searchTerm) ||
        rec.response_category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec.speech_text && rec.speech_text.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (rec.filename && rec.filename.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Sort recordings
    filtered.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case 'timestamp':
          aValue = new Date(a.timestamp).getTime()
          bValue = new Date(b.timestamp).getTime()
          break
        case 'phone_number':
          aValue = a.phone_number
          bValue = b.phone_number
          break
        case 'duration':
          // Convert duration to seconds for proper sorting
          aValue = durationToSeconds(a.duration)
          bValue = durationToSeconds(b.duration)
          break
        case 'response_category':
          aValue = a.response_category
          bValue = b.response_category
          break
        case 'size':
          // Convert size to bytes for proper sorting
          aValue = sizeToBytes(a.size || '')
          bValue = sizeToBytes(b.size || '')
          break
        default:
          aValue = a.timestamp
          bValue = b.timestamp
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    setFilteredRecordings(filtered)
  }, [searchTerm, recordings, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const handleDownload = async (recording: Recording) => {
    try {
      // Create a temporary anchor element for download
      const link = document.createElement('a')
      link.href = recording.audio_url
      link.download = recording.filename || `recording_${recording.phone_number}_${recording.timestamp.replace(/[: ]/g, '-')}.wav`
      link.target = '_blank'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error downloading recording:', error)
      setError('Failed to download recording. The file might not be accessible.')
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

  // Helper functions for sorting
  const durationToSeconds = (duration: string): number => {
    if (!duration) return 0
    if (duration.includes(':')) {
      const parts = duration.split(':').map(p => parseInt(p) || 0)
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
      } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1]
      }
    }
    return parseInt(duration) || 0
  }

  const sizeToBytes = (size: string): number => {
    if (!size) return 0
    const match = size.match(/^([\d.]+)\s*([KMGT]?B)$/i)
    if (match) {
      const value = parseFloat(match[1])
      const unit = match[2].toUpperCase()
      switch (unit) {
        case 'KB': return value * 1024
        case 'MB': return value * 1024 * 1024
        case 'GB': return value * 1024 * 1024 * 1024
        case 'TB': return value * 1024 * 1024 * 1024 * 1024
        default: return value
      }
    }
    return 0
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
              {clientName && <span className="text-lg font-normal text-gray-600">- {clientName}</span>}
            </h1>
            <p className="text-gray-600 mt-1">
              Listen to and download your call recordings
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchRecordings}
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

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                {/* Refresh Button */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Actions
                  </label>
                  <Button 
                    onClick={fetchRecordings}
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
            <p className="text-sm text-gray-600">
              Showing {filteredRecordings.length} of {recordings.length} recordings
              {selectedDate && ` for ${format(new Date(selectedDate), 'MMMM d, yyyy')}`}
            </p>
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
          ) : filteredRecordings.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <FileAudio className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No recordings found</h3>
                  <p className="text-gray-500">
                    {recordings.length === 0 
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
                      {filteredRecordings.map((recording) => (
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
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
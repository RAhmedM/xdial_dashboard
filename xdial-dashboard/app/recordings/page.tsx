'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileAudio, Play, Pause, Download, Search, Calendar, Filter, AlertTriangle, RefreshCcw } from 'lucide-react'
import DashboardHeader from '@/components/dashboard-header'

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

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [filteredRecordings, setFilteredRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string>('')

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
    if (!user?.client_id) return

    setLoading(true)
    setError(null)
    setWarning(null)
    
    try {
      const response = await fetch(`/api/recordings?client_id=${user.client_id}&date=${selectedDate}`)
      
      const data: ApiResponse = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch recordings')
      }
      
      setRecordings(data.recordings || [])
      setFilteredRecordings(data.recordings || [])
      setClientName(data.client_name || '')
      
      // Show warning if there's one
      if (data.warning) {
        setWarning(data.warning)
      }
      
    } catch (error) {
      console.error('Error fetching recordings:', error)
      setError(error instanceof Error ? error.message : 'Failed to load recordings')
      setRecordings([])
      setFilteredRecordings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.client_id) {
      fetchRecordings()
    }
  }, [user, selectedDate])

  // Filter recordings based on search and category
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

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(rec => rec.response_category === categoryFilter)
    }

    setFilteredRecordings(filtered)
  }, [searchTerm, categoryFilter, recordings])

  const handleDownload = async (recording: Recording) => {
    try {
      // Create a temporary anchor element for download
      const link = document.createElement('a')
      link.href = recording.audio_url
      link.download = recording.filename || `recording_${recording.phone_number}_${recording.timestamp.replace(/[: ]/g, '-')}.wav`
      link.target = '_blank'
      
      // For external URLs, we might need to handle CORS differently
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
      case 'UNKNOWN':
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const uniqueCategories = Array.from(new Set(recordings.map(r => r.response_category)))

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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

                {/* Category Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Filter className="h-4 w-4" />
                    Category
                  </label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

          {/* Recordings List */}
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
            <div className="space-y-4">
              {filteredRecordings.map((recording) => (
                <Card key={recording.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Recording Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {recording.phone_number}
                          </h3>
                          <Badge className={getStatusBadgeColor(recording.response_category)}>
                            {recording.response_category}
                          </Badge>
                          {recording.size && (
                            <span className="text-sm text-gray-500">
                              {recording.size}
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-4">
                            <span>
                              <strong>Time:</strong> {formatTimestamp(recording.timestamp)}
                            </span>
                            <span>
                              <strong>Duration:</strong> {formatDuration(recording.duration)}
                            </span>
                          </div>
                          
                          {recording.filename && (
                            <div>
                              <strong>File:</strong> {recording.filename}
                            </div>
                          )}
                          
                          {recording.call_id && (
                            <div>
                              <strong>Call ID:</strong> {recording.call_id}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
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
                                className="w-48"
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
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
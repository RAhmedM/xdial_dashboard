"use client"

import { useState, useEffect } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AudioPlayer } from "@/components/audio-player"
import { Calendar, Search, Download, Play, Pause, FileAudio, Clock, Phone, Tag } from "lucide-react"
import { format } from "date-fns"

interface Recording {
  id: string
  unique_id: string
  timestamp: string
  duration: string
  phone_number: string
  response_category: string
  speech_text?: string
  audio_url: string
  size?: string
  call_id?: string
  database_category?: string
}

interface User {
  id: number
  username: string
  role: string
  name: string
  client_id?: number
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
  useEffect(() => {
    const fetchRecordings = async () => {
      if (!user?.client_id) return

      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/recordings?client_id=${user.client_id}&date=${selectedDate}`)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to fetch recordings')
        }
        
        const data = await response.json()
        setRecordings(data.recordings || [])
        setFilteredRecordings(data.recordings || [])
      } catch (error) {
        console.error('Error fetching recordings:', error)
        setError(error.message || 'Failed to load recordings')
        setRecordings([])
        setFilteredRecordings([])
      } finally {
        setLoading(false)
      }
    }

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
        (rec.speech_text && rec.speech_text.toLowerCase().includes(searchTerm.toLowerCase()))
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
      // Create a temporary anchor element
      const link = document.createElement('a')
      link.href = recording.audio_url
      link.download = `recording_${recording.phone_number}_${recording.timestamp.replace(/[: ]/g, '-')}.wav`
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error downloading recording:', error)
    }
  }

  const formatDuration = (duration: string) => {
    // Assuming duration is in seconds or "MM:SS" format
    if (duration.includes(':')) {
      return duration
    }
    const totalSeconds = parseInt(duration)
    if (isNaN(totalSeconds)) return duration
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
            </h1>
            <p className="text-gray-600 mt-1">
              Listen to and download your call recordings
            </p>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Date Picker */}
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by phone or text..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Category Filter */}
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by category" />
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

                {/* Summary Stats */}
                <div className="flex items-center justify-center text-sm text-gray-600">
                  <span className="font-medium">{filteredRecordings.length}</span>
                  <span className="ml-1">recordings found</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading recordings...</p>
              </div>
            </div>
          )}

          {/* Recordings List */}
          {!loading && filteredRecordings.length === 0 && !error && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-gray-500">
                  <FileAudio className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No recordings found for the selected date</p>
                  <p className="text-sm mt-2">Try selecting a different date or check if recordings are available.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && filteredRecordings.length > 0 && (
            <div className="space-y-4">
              {filteredRecordings.map((recording) => (
                <Card key={recording.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-4">
                      {/* Recording Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="flex items-center gap-1 text-sm text-gray-600">
                              <Phone className="h-4 w-4" />
                              {recording.phone_number}
                            </span>
                            <span className="flex items-center gap-1 text-sm text-gray-600">
                              <Clock className="h-4 w-4" />
                              {new Date(recording.timestamp).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1 text-sm text-gray-600">
                              <Tag className="h-4 w-4" />
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                recording.response_category === 'POSITIVE' ? 'bg-green-100 text-green-800' :
                                recording.response_category === 'NEGATIVE' ? 'bg-red-100 text-red-800' :
                                recording.response_category === 'NEUTRAL' ? 'bg-gray-100 text-gray-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {recording.response_category}
                              </span>
                            </span>
                          </div>
                          
                          {/* Speech Text Preview */}
                          {recording.speech_text && (
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                              "{recording.speech_text}"
                            </p>
                          )}

                          {/* File Size */}
                          {recording.size && (
                            <p className="text-xs text-gray-400">
                              File size: {recording.size}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">
                            {formatDuration(recording.duration)}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(recording)}
                            title="Download recording"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Audio Player */}
                      <AudioPlayer
                        src={recording.audio_url}
                        recordingId={recording.id}
                        isPlaying={playingId === recording.id}
                        onPlayStateChange={(playing) => {
                          setPlayingId(playing ? recording.id : null)
                        }}
                      />
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

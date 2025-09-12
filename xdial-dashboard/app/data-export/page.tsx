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
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Download,
  FileText,
  Calendar,
  Filter,
  Check,
  AlertCircle,
  List,
  Phone,
  Star,
  Ban,
  AlertTriangle,
  HelpCircle,
  RotateCcw,
  Loader2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ExportFilters {
  selectedListIds: string[]
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  selectedDispositions: string[]
  exportType: 'all' | 'by-list' | 'by-date' | 'by-disposition'
}

interface User {
  id?: number
  username?: string
  role?: string
  name?: string
  extension?: string
}

interface ListIdOption {
  list_id: string
  count: number
}

const dispositionOptions = [
  {
    id: "answering-machine",
    label: "Answering Machine",
    icon: Phone,
    iconColor: "text-blue-500",
    dbValue: "Answering_Machine"
  },
  {
    id: "interested",
    label: "Interested",
    icon: Star,
    iconColor: "text-green-500",
    dbValue: "Interested"
  },
  {
    id: "not-interested",
    label: "Not Interested",
    icon: Star,
    iconColor: "text-red-500",
    dbValue: "Not_Interested"
  },
  {
    id: "do-not-call",
    label: "Do Not Call",
    icon: Ban,
    iconColor: "text-pink-500",
    dbValue: "DNC"
  },
  {
    id: "do-not-qualify",
    label: "Do Not Qualify",
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
    dbValue: "DNQ"
  },
  {
    id: "unknown",
    label: "Unknown",
    icon: HelpCircle,
    iconColor: "text-gray-500",
    dbValue: "Unknown"
  }
]

export default function DataExportPage() {
  const [filters, setFilters] = useState<ExportFilters>({
    selectedListIds: [],
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    selectedDispositions: [],
    exportType: 'all'
  })

  const [user, setUser] = useState<User | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [availableListIds, setAvailableListIds] = useState<ListIdOption[]>([])
  const [loadingListIds, setLoadingListIds] = useState(true)
  const [exportStats, setExportStats] = useState({
    totalRecords: 0,
    estimatedSize: ''
  })

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
    if (userType) {
      fetchAvailableListIds()
    }
  }, [userType, user])

  useEffect(() => {
    updateExportStats()
  }, [filters])

  const fetchAvailableListIds = async () => {
    setLoadingListIds(true)
    try {
      const params = new URLSearchParams()
      
      // Add client filter for non-admin users
      if (userType === 'client' && user?.id) {
        params.append('client_id', user.id.toString())
      }

      const response = await fetch(`/api/export/list-ids?${params}`)
      if (!response.ok) throw new Error('Failed to fetch list IDs')

      const data = await response.json()
      setAvailableListIds(data.listIds || [])
    } catch (error) {
      console.error('Error fetching list IDs:', error)
      toast({
        title: "Error",
        description: "Failed to fetch available List IDs",
        variant: "destructive"
      })
    } finally {
      setLoadingListIds(false)
    }
  }

  const updateExportStats = async () => {
    try {
      const params = buildExportParams()
      params.append('count_only', 'true')

      const response = await fetch(`/api/export/preview?${params}`)
      if (!response.ok) throw new Error('Failed to get export preview')

      const data = await response.json()
      setExportStats({
        totalRecords: data.count || 0,
        estimatedSize: data.estimatedSize || '0 KB'
      })
    } catch (error) {
      console.error('Error getting export preview:', error)
      setExportStats({ totalRecords: 0, estimatedSize: '0 KB' })
    }
  }

  const buildExportParams = () => {
    const params = new URLSearchParams()

    // Add client filter for non-admin users
    if (userType === 'client' && user?.id) {
      params.append('client_id', user.id.toString())
    }

    // Add date filters
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

    // Add List ID filters
    if (filters.selectedListIds.length > 0) {
      filters.selectedListIds.forEach(listId => {
        params.append('list_ids', listId)
      })
    }

    // Add disposition filters
    if (filters.selectedDispositions.length > 0) {
      const dbValues = filters.selectedDispositions.map(dispId => {
        const disposition = dispositionOptions.find(d => d.id === dispId)
        return disposition?.dbValue || dispId
      })
      dbValues.forEach(dbValue => {
        params.append('response_categories', dbValue)
      })
    }

    params.append('export_type', filters.exportType)

    return params
  }

  const handleExport = async () => {
    if (exportStats.totalRecords === 0) {
      toast({
        title: "No Data",
        description: "No records found matching your criteria",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const params = buildExportParams()
      
      const response = await fetch(`/api/export/csv?${params}`)
      if (!response.ok) throw new Error('Failed to export data')

      // Get the CSV content
      const csvContent = await response.text()
      
      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
        const filename = `call-data-export-${timestamp}.csv`
        link.setAttribute('download', filename)
        
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }

      toast({
        title: "Export Successful",
        description: `Downloaded ${exportStats.totalRecords} records`,
      })
    } catch (error) {
      console.error('Error exporting data:', error)
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: keyof ExportFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleListIdToggle = (listId: string, checked: boolean) => {
    const updated = checked
      ? [...filters.selectedListIds, listId]
      : filters.selectedListIds.filter(id => id !== listId)
    
    setFilters(prev => ({ ...prev, selectedListIds: updated }))
  }

  const handleDispositionToggle = (dispositionId: string, checked: boolean) => {
    const updated = checked
      ? [...filters.selectedDispositions, dispositionId]
      : filters.selectedDispositions.filter(id => id !== dispositionId)
    
    setFilters(prev => ({ ...prev, selectedDispositions: updated }))
  }

  const resetFilters = () => {
    setFilters({
      selectedListIds: [],
      startDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      selectedDispositions: [],
      exportType: 'all'
    })
  }

  const selectAllListIds = () => {
    setFilters(prev => ({ 
      ...prev, 
      selectedListIds: availableListIds.map(item => item.list_id) 
    }))
  }

  const selectAllDispositions = () => {
    setFilters(prev => ({ 
      ...prev, 
      selectedDispositions: dispositionOptions.map(d => d.id) 
    }))
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
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Download className="h-8 w-8 text-blue-500" />
              Data Export
            </h1>
            <p className="text-gray-600 mt-2">
              Export call data in CSV format with advanced filtering options
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Filters Panel */}
            <div className="lg:col-span-2 space-y-6">
              {/* Export Type Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Export Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select 
                    value={filters.exportType} 
                    onValueChange={(value) => handleFilterChange('exportType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Export All Data</SelectItem>
                      <SelectItem value="by-list">Filter by List ID</SelectItem>
                      <SelectItem value="by-date">Filter by Date Range</SelectItem>
                      <SelectItem value="by-disposition">Filter by Disposition</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* List ID Filter */}
              {(filters.exportType === 'by-list' || filters.exportType === 'all') && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <List className="h-5 w-5" />
                      List ID Selection
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingListIds ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">Loading List IDs...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center mb-4">
                          <Label>Select List IDs to export:</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={selectAllListIds}
                          >
                            Select All ({availableListIds.length})
                          </Button>
                        </div>
                        
                        {availableListIds.length === 0 ? (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              No List IDs found. Calls without List IDs will be included in exports.
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                            {availableListIds.map((item) => (
                              <div key={item.list_id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`list-${item.list_id}`}
                                  checked={filters.selectedListIds.includes(item.list_id)}
                                  onCheckedChange={(checked) => 
                                    handleListIdToggle(item.list_id, checked as boolean)
                                  }
                                />
                                <label
                                  htmlFor={`list-${item.list_id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 flex-1"
                                >
                                  {item.list_id}
                                  <Badge variant="outline" className="text-xs">
                                    {item.count} calls
                                  </Badge>
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Date Range Filter */}
              {(filters.exportType === 'by-date' || filters.exportType === 'all') && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Date Range Selection
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={filters.startDate}
                          onChange={(e) => handleFilterChange('startDate', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="start-time">Start Time</Label>
                        <Input
                          id="start-time"
                          type="time"
                          value={filters.startTime}
                          onChange={(e) => handleFilterChange('startTime', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-date">End Date</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={filters.endDate}
                          onChange={(e) => handleFilterChange('endDate', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-time">End Time</Label>
                        <Input
                          id="end-time"
                          type="time"
                          value={filters.endTime}
                          onChange={(e) => handleFilterChange('endTime', e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Disposition Filter */}
              {(filters.exportType === 'by-disposition' || filters.exportType === 'all') && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Disposition Selection
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center mb-4">
                      <Label>Select dispositions to export:</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllDispositions}
                      >
                        Select All ({dispositionOptions.length})
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {dispositionOptions.map((disposition) => (
                        <div key={disposition.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`disposition-${disposition.id}`}
                            checked={filters.selectedDispositions.includes(disposition.id)}
                            onCheckedChange={(checked) => 
                              handleDispositionToggle(disposition.id, checked as boolean)
                            }
                          />
                          <label
                            htmlFor={`disposition-${disposition.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                          >
                            <disposition.icon className={`h-4 w-4 ${disposition.iconColor}`} />
                            {disposition.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Export Summary Panel */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    Export Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Records:</span>
                      <span className="font-medium">{exportStats.totalRecords.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Estimated Size:</span>
                      <span className="font-medium">{exportStats.estimatedSize}</span>
                    </div>
                  </div>

                  {filters.selectedListIds.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600">Selected List IDs:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {filters.selectedListIds.slice(0, 3).map(listId => (
                          <Badge key={listId} variant="outline" className="text-xs">
                            {listId}
                          </Badge>
                        ))}
                        {filters.selectedListIds.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{filters.selectedListIds.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {filters.selectedDispositions.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600">Selected Dispositions:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {filters.selectedDispositions.slice(0, 2).map(dispId => {
                          const disp = dispositionOptions.find(d => d.id === dispId)
                          return (
                            <Badge key={dispId} variant="outline" className="text-xs">
                              {disp?.label || dispId}
                            </Badge>
                          )
                        })}
                        {filters.selectedDispositions.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{filters.selectedDispositions.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {(filters.startDate || filters.endDate) && (
                    <div>
                      <span className="text-sm text-gray-600">Date Range:</span>
                      <div className="mt-1 text-sm">
                        {filters.startDate || 'Any'} to {filters.endDate || 'Any'}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <Button
                    onClick={handleExport}
                    disabled={loading || exportStats.totalRecords === 0}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Export to CSV
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={resetFilters}
                    variant="outline"
                    className="w-full"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Filters
                  </Button>
                </CardContent>
              </Card>

              {/* Help Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Export Information</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-600 space-y-2">
                  <p>• CSV files include all call details: ID, phone number, List ID, disposition, timestamp, and recording URL</p>
                  <p>• Large exports may take a few moments to generate</p>
                  <p>• Files are automatically named with the current date</p>
                  <p>• {userType === 'client' ? 'Only your call data will be exported' : 'Admin can export all client data'}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
        
        <Toaster />
      </div>
    </AuthWrapper>
  )
}
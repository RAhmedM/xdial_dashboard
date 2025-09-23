// app/vicidial/page.tsx
"use client"

import { useState, useEffect } from "react"
import { AuthWrapper } from "@/components/auth-wrapper"
import { AdminHeader } from "@/components/admin-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import {
  Play,
  Square,
  RotateCw,
  Plus,
  Settings,
  Trash2,
  FileText,
  Activity,
  Clock,
  Link,
  User,
  Key,
  Timer,
  RefreshCw,
  Terminal,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle
} from "lucide-react"

interface ViciDialService {
  name: string
  status: 'active' | 'inactive' | 'failed'
  config: {
    base_url: string
    username: string
    password?: string
    target_sessionid: string
    time_threshold: number
    check_interval: number
    description: string
    script_path?: string
    service_path?: string
  }
}

interface ServiceFormData {
  serviceName: string
  baseUrl: string
  username: string
  password: string
  targetSessionId: string
  timeThreshold: number
  checkInterval: number
  description: string
}

export default function ViciDialManagementPage() {
  const [services, setServices] = useState<ViciDialService[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<ViciDialService | null>(null)
  const [logs, setLogs] = useState<string>("")
  const [logsLoading, setLogsLoading] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [deleteService, setDeleteService] = useState<ViciDialService | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<ServiceFormData>({
    serviceName: '',
    baseUrl: '',
    username: '',
    password: '',
    targetSessionId: '',
    timeThreshold: 90,
    checkInterval: 5,
    description: ''
  })

  const { toast } = useToast()

  useEffect(() => {
    fetchServices()
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchServices, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/vicidial/services')
      if (!response.ok) throw new Error('Failed to fetch services')
      
      const data = await response.json()
      setServices(data.services || [])
    } catch (error) {
      console.error('Error fetching services:', error)
      toast({
        title: "Error",
        description: "Failed to fetch services",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async (serviceName: string, lines: number = 50) => {
    setLogsLoading(true)
    try {
      const response = await fetch(`/api/vicidial/services/${serviceName}/logs?lines=${lines}`)
      if (!response.ok) throw new Error('Failed to fetch logs')
      
      const data = await response.json()
      setLogs(data.logs || 'No logs available')
    } catch (error) {
      console.error('Error fetching logs:', error)
      setLogs('Failed to fetch logs')
    } finally {
      setLogsLoading(false)
    }
  }

  const handleServiceAction = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    setActionLoading(`${serviceName}-${action}`)
    try {
      const response = await fetch(`/api/vicidial/services/${serviceName}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (!response.ok) throw new Error(`Failed to ${action} service`)
      
      const data = await response.json()
      
      toast({
        title: "Success",
        description: data.message
      })

      // Refresh services
      await fetchServices()
    } catch (error) {
      console.error(`Error ${action}ing service:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} service`,
        variant: "destructive"
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreateService = async () => {
    try {
      const response = await fetch('/api/vicidial/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create service')
      }
      
      toast({
        title: "Success",
        description: "Service created successfully"
      })

      // Reset form and close dialog
      setFormData({
        serviceName: '',
        baseUrl: '',
        username: '',
        password: '',
        targetSessionId: '',
        timeThreshold: 90,
        checkInterval: 5,
        description: ''
      })
      setIsCreateDialogOpen(false)
      
      // Refresh services
      await fetchServices()
    } catch (error) {
      console.error('Error creating service:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create service",
        variant: "destructive"
      })
    }
  }

  const handleUpdateService = async () => {
    if (!selectedService) return

    try {
      const response = await fetch(`/api/vicidial/services/${selectedService.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: formData.baseUrl,
          username: formData.username,
          password: formData.password,
          target_sessionid: formData.targetSessionId,
          time_threshold: formData.timeThreshold,
          check_interval: formData.checkInterval,
          description: formData.description
        })
      })

      if (!response.ok) throw new Error('Failed to update service')
      
      toast({
        title: "Success",
        description: "Service updated successfully"
      })

      setIsEditDialogOpen(false)
      await fetchServices()
    } catch (error) {
      console.error('Error updating service:', error)
      toast({
        title: "Error",
        description: "Failed to update service",
        variant: "destructive"
      })
    }
  }

  const handleDeleteService = async () => {
    if (!deleteService) return

    try {
      const response = await fetch(`/api/vicidial/services/${deleteService.name}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete service')
      
      toast({
        title: "Success",
        description: "Service deleted successfully"
      })

      setDeleteService(null)
      await fetchServices()
    } catch (error) {
      console.error('Error deleting service:', error)
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive"
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 text-white">Active</Badge>
      case 'failed':
        return <Badge className="bg-red-500 text-white">Failed</Badge>
      default:
        return <Badge className="bg-gray-500 text-white">Inactive</Badge>
    }
  }

  return (
    <AuthWrapper requiredRole="admin">
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        
        <div className="container mx-auto px-6 py-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">ViciDial Service Manager</h2>
                <p className="text-gray-600">Manage auto-logout services for long call handling</p>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Service
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New ViciDial Service</DialogTitle>
                    <DialogDescription>
                      Configure a new auto-logout service for ViciDial agents
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="serviceName">Service Name</Label>
                        <Input
                          id="serviceName"
                          value={formData.serviceName}
                          onChange={(e) => setFormData(prev => ({ ...prev, serviceName: e.target.value }))}
                          placeholder="my-service"
                        />
                      </div>
                      <div>
                        <Label htmlFor="targetSessionId">Extension/Session ID</Label>
                        <Input
                          id="targetSessionId"
                          value={formData.targetSessionId}
                          onChange={(e) => setFormData(prev => ({ ...prev, targetSessionId: e.target.value }))}
                          placeholder="8001"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="baseUrl">ViciDial Base URL</Label>
                      <Input
                        id="baseUrl"
                        value={formData.baseUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
                        placeholder="https://vicidial.example.com/vicidial"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={formData.username}
                          onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="timeThreshold">Time Threshold (seconds)</Label>
                        <Input
                          id="timeThreshold"
                          type="number"
                          value={formData.timeThreshold}
                          onChange={(e) => setFormData(prev => ({ ...prev, timeThreshold: parseInt(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="checkInterval">Check Interval (seconds)</Label>
                        <Input
                          id="checkInterval"
                          type="number"
                          value={formData.checkInterval}
                          onChange={(e) => setFormData(prev => ({ ...prev, checkInterval: parseInt(e.target.value) }))}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description">Description (optional)</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Auto-logout service for extension 8001"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateService} className="bg-blue-500 hover:bg-blue-600">
                      Create Service
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {loading ? (
                <Card className="col-span-full">
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </CardContent>
                </Card>
              ) : services.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="text-center py-12">
                    <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Services Configured</h3>
                    <p className="text-gray-500 mb-4">Create your first ViciDial auto-logout service to get started</p>
                    <Button 
                      onClick={() => setIsCreateDialogOpen(true)}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Service
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                services.map((service) => (
                  <Card key={service.name} className="relative">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {getStatusIcon(service.status)}
                            {service.name}
                          </CardTitle>
                          <p className="text-sm text-gray-500 mt-1">
                            Extension: {service.config.target_sessionid}
                          </p>
                        </div>
                        {getStatusBadge(service.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Link className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600 truncate">{service.config.base_url}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">{service.config.username}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Timer className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Threshold: {service.config.time_threshold}s</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Check every: {service.config.check_interval}s</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        {service.status === 'active' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleServiceAction(service.name, 'stop')}
                            disabled={actionLoading === `${service.name}-stop`}
                            className="text-red-600 hover:text-red-700"
                          >
                            {actionLoading === `${service.name}-stop` ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleServiceAction(service.name, 'start')}
                            disabled={actionLoading === `${service.name}-start`}
                            className="text-green-600 hover:text-green-700"
                          >
                            {actionLoading === `${service.name}-start` ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleServiceAction(service.name, 'restart')}
                          disabled={actionLoading === `${service.name}-restart`}
                        >
                          {actionLoading === `${service.name}-restart` ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCw className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedService(service)
                            fetchLogs(service.name)
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Additional Actions */}
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedService(service)
                            setFormData({
                              serviceName: service.name,
                              baseUrl: service.config.base_url,
                              username: service.config.username,
                              password: '',
                              targetSessionId: service.config.target_sessionid,
                              timeThreshold: service.config.time_threshold,
                              checkInterval: service.config.check_interval,
                              description: service.config.description
                            })
                            setIsEditDialogOpen(true)
                          }}
                          className="flex-1"
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Configure
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteService(service)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Logs Panel */}
            {selectedService && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Terminal className="h-5 w-5" />
                      Service Logs: {selectedService.name}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fetchLogs(selectedService.name, 100)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-auto max-h-96">
                    {logsLoading ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading logs...
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap">{logs}</pre>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteService} onOpenChange={() => setDeleteService(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Service</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the service "{deleteService?.name}"? 
                This will stop the service and remove all associated files. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteService}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Service
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Toaster />
      </div>
    </AuthWrapper>
  )
}
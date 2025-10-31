"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter 
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
import { Plus, Edit, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Client {
  client_id: number
  client_name: string
  password: string
  extension: string
  call_data_url: string
  fetch_recording_url: string
}

interface ClientFormData {
  client_name: string
  password: string
  extension: string
  call_data_url: string
  fetch_recording_url: string
}

export function ClientManagement() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({})
  const [formData, setFormData] = useState<ClientFormData>({
    client_name: "",
    password: "",
    extension: "",
    call_data_url: "",
    fetch_recording_url: ""
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const fetchClients = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/clients')
      if (!response.ok) throw new Error('Failed to fetch clients')
      
      const data = await response.json()
      setClients(data)
    } catch (error) {
      console.error('Error fetching clients:', error)
      toast({
        title: "Error",
        description: "Failed to fetch clients",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const validateForm = () => {
    const errors: Record<string, string> = {}
    
    if (!formData.client_name.trim()) errors.client_name = "Client name is required"
    if (!formData.password.trim()) errors.password = "Password is required"
    if (!formData.extension.trim()) errors.extension = "Extension is required"
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const url = editingClient ? `/api/clients/${editingClient.client_id}` : '/api/clients'
      const method = editingClient ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error(`Failed to ${editingClient ? 'update' : 'create'} client`)

      toast({
        title: "Success",
        description: `Client ${editingClient ? 'updated' : 'created'} successfully`
      })

      await fetchClients()
      handleCloseDialog()
    } catch (error) {
      console.error('Error saving client:', error)
      toast({
        title: "Error",
        description: `Failed to ${editingClient ? 'update' : 'create'} client`,
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingClient) return

    try {
      const response = await fetch(`/api/clients/${deletingClient.client_id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete client')

      toast({
        title: "Success",
        description: "Client deleted successfully"
      })

      await fetchClients()
      setDeletingClient(null)
    } catch (error) {
      console.error('Error deleting client:', error)
      toast({
        title: "Error",
        description: "Failed to delete client",
        variant: "destructive"
      })
    }
  }

  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setFormData({
      client_name: client.client_name,
      password: client.password,
      extension: client.extension,
      call_data_url: client.call_data_url || "",
      fetch_recording_url: client.fetch_recording_url || ""
    })
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingClient(null)
    setFormData({
      client_name: "",
      password: "",
      extension: "",
      call_data_url: "",
      fetch_recording_url: ""
    })
    setFormErrors({})
  }

  const togglePasswordVisibility = (clientId: number) => {
    setShowPasswords(prev => ({ ...prev, [clientId]: !prev[clientId] }))
  }

  const handleOpenClientDashboard = async (client: Client) => {
    try {
      // First, authenticate the client
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: client.client_id.toString(),
          password: client.password
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        toast({
          title: "Error",
          description: data.error || "Failed to authenticate client",
          variant: "destructive"
        })
        return
      }

      // Store user data temporarily with a special key for the new window
      // We'll use a timestamp-based key to ensure uniqueness
      const tempKey = `temp_auth_${Date.now()}`
      const authData = {
        user: data.user,
        userType: data.userType
      }
      localStorage.setItem(tempKey, JSON.stringify(authData))

      // Open new window with dashboard URL and temp key
      const newWindow = window.open(`/dashboard?tempAuth=${tempKey}`, '_blank')

      if (!newWindow) {
        localStorage.removeItem(tempKey)
        toast({
          title: "Error",
          description: "Please allow popups to open client dashboard",
          variant: "destructive"
        })
        return
      }

      toast({
        title: "Success",
        description: `Opening ${client.client_name}'s dashboard`
      })
    } catch (error) {
      console.error('Error opening client dashboard:', error)
      toast({
        title: "Error",
        description: "Failed to open client dashboard",
        variant: "destructive"
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Client Management</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? 'Edit Client' : 'Add New Client'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="client_name">Client Name *</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                    placeholder="Enter client name"
                  />
                  {formErrors.client_name && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.client_name}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password"
                  />
                  {formErrors.password && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.password}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="extension">Extension *</Label>
                  <Input
                    id="extension"
                    value={formData.extension}
                    onChange={(e) => setFormData(prev => ({ ...prev, extension: e.target.value }))}
                    placeholder="Enter extension"
                  />
                  {formErrors.extension && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.extension}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="call_data_url">Call Data URL</Label>
                  <Input
                    id="call_data_url"
                    value={formData.call_data_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, call_data_url: e.target.value }))}
                    placeholder="Enter call data URL"
                  />
                </div>

                <div>
                  <Label htmlFor="fetch_recording_url">Fetch Recording URL</Label>
                  <Input
                    id="fetch_recording_url"
                    value={formData.fetch_recording_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, fetch_recording_url: e.target.value }))}
                    placeholder="Enter fetch recording URL"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={submitting}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {submitting ? 'Saving...' : (editingClient ? 'Update' : 'Create')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Client Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Password</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Extension</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Call Data URL</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Recording URL</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.client_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{client.client_id}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{client.client_name}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <span className="font-mono">
                          {showPasswords[client.client_id] ? client.password : '••••••••'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePasswordVisibility(client.client_id)}
                        >
                          {showPasswords[client.client_id] ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{client.extension}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 max-w-48 truncate">
                      {client.call_data_url || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 max-w-48 truncate">
                      {client.fetch_recording_url || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenClientDashboard(client)}
                          title="Open client dashboard"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(client)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingClient(client)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {clients.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No clients found. Add your first client to get started.
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingClient} onOpenChange={() => setDeletingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingClient?.client_name}"? 
              This action cannot be undone and will also delete all associated call records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
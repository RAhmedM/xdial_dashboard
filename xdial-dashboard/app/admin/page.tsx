import { AdminHeader } from "@/components/admin-header"
import { ClientManagement } from "@/components/client-management"
import { StatsCardsUpdated } from "@/components/stats-cards-updated"
import { CallRecordsUpdated } from "@/components/call-records-updated"
import { AuthWrapper } from "@/components/auth-wrapper"
import { Toaster } from "@/components/ui/toaster"

export default function AdminPage() {
  return (
    <AuthWrapper requiredRole="admin">
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />

        <div className="container mx-auto px-6 py-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h2>
              <p className="text-gray-600">Manage clients and monitor system performance</p>
            </div>

            {/* Overview Stats */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Overview</h3>
              <StatsCardsUpdated />
            </div>


            {/* Client Management */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Management</h3>
              <ClientManagement />
            </div>

            {/* Recent Call Records */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">All Call Records</h3>
              <CallRecordsUpdated />
            </div>
          </div>
        </div>
        
        <Toaster />
      </div>
    </AuthWrapper>
  )
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Play, X } from "lucide-react"
import { CallOutcomesFilter } from "@/components/filter-section"

const callRecords = [
  {
    id: 1,
    phoneNo: "1113",
    responseCategory: "INTERESTED_hello",
    message: "HELLO",
    timestamp: "2025-08-18 10:25:49",
    categoryColor: "bg-blue-500",
  },
  {
    id: 2,
    phoneNo: "1113",
    responseCategory: "UNKNOWN_greeting",
    message: "GREETING",
    timestamp: "2025-08-18 10:25:58",
    categoryColor: "bg-gray-500",
  },
  {
    id: 3,
    phoneNo: "3055131132",
    responseCategory: "USER_SILENT",
    message: "HELLO",
    timestamp: "2025-08-18 10:26:05",
    categoryColor: "bg-yellow-500",
  },
]

export function CallRecords() {
  const selectedFilters = [
    { name: "Answering Machine", count: 458 },
    { name: "Interested", count: 393 },
  ]

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        {selectedFilters.length > 0 && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-blue-900">Active Filters:</span>
              {selectedFilters.map((filter, index) => (
                <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                  {filter.name} ({filter.count})
                  <X className="h-3 w-3 ml-1 cursor-pointer" />
                </Badge>
              ))}
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 ml-2">
                Clear All
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Call Records</CardTitle>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search records..." className="pl-10 w-64" />
                </div>
                <span className="text-sm text-gray-500">25 per page</span>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">#</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Phone No</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Response Category</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Timestamp</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {callRecords.map((record) => (
                    <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">{record.id}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{record.phoneNo}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Badge className={`${record.categoryColor} text-white`}>{record.responseCategory}</Badge>
                          <span className="text-sm text-gray-600">{record.message}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{record.timestamp}</td>
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="sm">
                          <Play className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <CallOutcomesFilter />
    </div>
  )
}

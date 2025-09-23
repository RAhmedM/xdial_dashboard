"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { X, Copy, Check, Phone, Calendar, Clock, User, FileText } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface TranscriptPopupProps {
  isOpen: boolean
  onClose: () => void
  transcript: string | null
  callId: number
  phoneNumber: string
  responseCategory: string
  timestamp: string
  clientName: string
  listId: string | null
}

export function TranscriptPopup({ isOpen, onClose, transcript, callId, phoneNumber, responseCategory, timestamp, clientName, listId }: TranscriptPopupProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    if (!transcript) return
    
    try {
      await navigator.clipboard.writeText(transcript)
      setCopied(true)
      toast({
        title: "Copied!",
        description: "Transcript copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy transcript",
        variant: "destructive"
      })
    }
  }

  const formatTranscript = (text: string) => {
    if (!text) return "No transcription available"
    
    // Split into sentences and add proper spacing
    return text
      .split(/(?<=[.!?])\s+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0)
      .join('\n\n')
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
      default:
        return 'bg-gray-400'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'N/A'
    
    try {
      const date = new Date(timestamp)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch (error) {
      return timestamp
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Call Transcript
              </DialogTitle>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    Call #{callId}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {phoneNumber}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {clientName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatTimestamp(timestamp)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    List ID: {listId || 'N/A'}
                  </span>
                  <Badge className={`${getCategoryColor(responseCategory)} text-white`}>
                    {responseCategory}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {transcript && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[60vh] px-6 py-4">
            {transcript ? (
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {formatTranscript(transcript)}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-4">📝</div>
                  <h3 className="text-lg font-medium mb-2">No Transcription Available</h3>
                  <p className="text-sm">
                    This call does not have a transcription yet.
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}

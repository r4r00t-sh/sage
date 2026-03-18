'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Editor } from '@/components/ui/editor';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  MessageSquare,
  Send,
  ArrowLeft,
  Building2,
  User,
  Clock,
  Eye,
  Upload,
  Lock,
  Unlock,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

interface OpinionFileData {
  file: {
    fileNumber: string;
    subject: string;
    description?: string;
    notes?: Array<Record<string, unknown>>;
    opinionNotes?: Array<Record<string, unknown>>;
    attachments?: Array<Record<string, unknown>>;
  };
  opinionRequest: {
    specialPermissionGranted: boolean;
    requestedBy: { name: string };
    requestedFromDepartment: { code: string };
    requestReason?: string;
  };
}

export default function OpinionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const opinionRequestId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [fileData, setFileData] = useState<OpinionFileData | null>(null);
  const [opinionNote, setOpinionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  useEffect(() => {
    fetchFileData();
  }, [opinionRequestId]);

  const fetchFileData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/opinions/requests/${opinionRequestId}/file`);
      setFileData(response.data);
    } catch (error: unknown) {
      toast.error('Failed to load opinion request');
      router.push('/opinions/inbox');
    } finally {
      setLoading(false);
    }
  };

  const addOpinionNote = async () => {
    if (!opinionNote.trim()) {
      toast.error('Please enter an opinion note');
      return;
    }

    try {
      await api.post(`/opinions/requests/${opinionRequestId}/notes`, {
        content: opinionNote,
      });
      toast.success('Opinion note added');
      setOpinionNote('');
      fetchFileData();
    } catch (error: unknown) {
      toast.error('Failed to add opinion note');
    }
  };

  const submitOpinion = async () => {
    if (!opinionNote.trim()) {
      toast.error('Please provide your opinion before submitting');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/opinions/requests/${opinionRequestId}/provide`, {
        opinionNote,
      });
      toast.success('Opinion submitted successfully');
      router.push('/opinions/inbox');
    } catch (error: unknown) {
      toast.error('Failed to submit opinion');
    } finally {
      setSubmitting(false);
      setShowSubmitDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!fileData) return null;

  const { file, opinionRequest } = fileData;
  const canViewAllNotes = opinionRequest.specialPermissionGranted;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push('/opinions/inbox')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Opinion Inbox
      </Button>

      {/* File Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                <FileText className="h-6 w-6" />
                <code className="text-xl font-mono">{file.fileNumber}</code>
              </CardTitle>
              <CardDescription className="mt-2 text-base">{file.subject}</CardDescription>
            </div>
            <Badge variant="outline" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Opinion Request
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Requested By</p>
              <p className="font-medium">{opinionRequest.requestedBy.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">From Department</p>
              <p className="font-medium">{opinionRequest.requestedFromDepartment.code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Request Reason</p>
              <p className="font-medium">{opinionRequest.requestReason || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Permission</p>
              <Badge variant="outline" className={cn(
                canViewAllNotes ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
              )}>
                {canViewAllNotes ? (
                  <>
                    <Unlock className="h-3 w-3 mr-1" />
                    Full Access
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3 mr-1" />
                    Limited Access
                  </>
                )}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Description */}
      {file.description && (
        <Card>
          <CardHeader>
            <CardTitle>File Matter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: file.description }} />
          </CardContent>
        </Card>
      )}

      {/* Notes Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Viewable Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {canViewAllNotes ? 'All Notes' : 'Current Desk Notes Only'}
            </CardTitle>
            <CardDescription>
              {canViewAllNotes
                ? 'You have special permission to view all notes'
                : 'You can only view notes from the requesting department'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[400px] overflow-auto">
              {file.notes && file.notes.length > 0 ? (
                file.notes.map((note: Record<string, unknown>) => (
                  <div key={String(note.id ?? '')} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{(note.user as { name: string })?.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(String(note.createdAt ?? '')), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: String(note.content ?? '') }} />
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No notes available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Opinion Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Your Opinion Notes
            </CardTitle>
            <CardDescription>
              Add notes as you review the file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Opinion Notes List */}
            <div className="space-y-3 max-h-[200px] overflow-auto">
              {file.opinionNotes && file.opinionNotes.length > 0 ? (
                file.opinionNotes.map((note: Record<string, unknown>) => (
                  <div key={String(note.id ?? '')} className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{(note.addedBy as { name: string })?.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(String(note.createdAt ?? '')), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm">{String(note.content ?? '')}</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4 text-sm">No opinion notes yet</p>
              )}
            </div>

            <Separator />

            {/* Add Opinion Note */}
            <div className="space-y-2">
              <Label>Add Opinion Note</Label>
              <Editor
                value={opinionNote}
                onChange={setOpinionNote}
                placeholder="Add your thoughts or findings..."
                minHeight="140px"
              />
              <Button onClick={addOpinionNote} disabled={!opinionNote.trim()}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attachments */}
      {file.attachments && file.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {file.attachments.map((att: Record<string, unknown>) => (
                <div key={String(att.id ?? '')} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{String(att.filename ?? '')}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(att.mimeType ?? '')} • {(Number(att.size ?? 0) / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/files/attachments/${String(att.id ?? '')}/download`, '_blank')}
                  >
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4 justify-end">
            <Button
              variant="outline"
              onClick={() => router.push('/opinions/inbox')}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setShowSubmitDialog(true)}
              disabled={!opinionNote.trim() && (!file.opinionNotes || file.opinionNotes.length === 0)}
            >
              <Send className="h-4 w-4 mr-2" />
              Submit Opinion
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Opinion</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit your opinion? This will send it back to the requesting department.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitOpinion} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Opinion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  Send,
  FileText,
  ArrowLeft,
  Upload,
  Loader2,
  Truck,
  Mail,
  MapPin,
} from 'lucide-react';
import { DepartmentProfileLink } from '@/components/profile-links';

interface ReadyFile {
  id: string;
  fileNumber?: string;
  subject?: string;
  status: string;
  department?: { id: string; name: string; code?: string } | null;
  currentDivision?: { id: string; name: string } | null;
}

const DISPATCH_METHODS = [
  { value: 'post', label: 'Post' },
  { value: 'courier', label: 'Courier' },
  { value: 'hand_delivery', label: 'Hand delivery' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
];

export default function DispatchPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [files, setFiles] = useState<ReadyFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<ReadyFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    dispatchMethod: '',
    trackingNumber: '',
    recipientName: '',
    recipientAddress: '',
    recipientEmail: '',
    remarks: '',
  });
  const [proofFile, setProofFile] = useState<File | null>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      // Dispatcher RBAC: GET /files returns files with status APPROVED (ready for dispatch)
      const response = await api.get('/files', { params: { status: 'APPROVED' } });
      const data = response.data?.data ?? response.data ?? [];
      setFiles(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load files ready for dispatch');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const openDispatchModal = (file: ReadyFile) => {
    setSelectedFile(file);
    setForm({
      dispatchMethod: '',
      trackingNumber: '',
      recipientName: '',
      recipientAddress: '',
      recipientEmail: '',
      remarks: '',
    });
    setProofFile(null);
    setDispatchModalOpen(true);
  };

  const handleDispatchSubmit = async () => {
    if (!selectedFile) return;
    if (!form.dispatchMethod.trim()) {
      toast.error('Please select a dispatch method');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('fileId', selectedFile.id);
      fd.append('dispatchMethod', form.dispatchMethod);
      if (form.trackingNumber.trim()) fd.append('trackingNumber', form.trackingNumber);
      if (form.recipientName.trim()) fd.append('recipientName', form.recipientName);
      if (form.recipientAddress.trim()) fd.append('recipientAddress', form.recipientAddress);
      if (form.recipientEmail.trim()) fd.append('recipientEmail', form.recipientEmail);
      if (form.remarks.trim()) fd.append('remarks', form.remarks);
      if (proofFile) fd.append('proofDocument', proofFile);

      await api.post('/dispatch/dispatch', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('File dispatched successfully');
      setDispatchModalOpen(false);
      setSelectedFile(null);
      fetchFiles();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to dispatch file');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && files.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 gap-2"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Ready for Dispatch</h1>
          <p className="text-muted-foreground mt-1">
            Files approved and waiting to be dispatched. Record dispatch details and upload proof.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dispatch/history')} className="gap-2">
          <FileText className="h-4 w-4" />
          Dispatch History
        </Button>
      </div>

      {files.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Send className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No files ready for dispatch</h3>
            <p className="text-muted-foreground text-center mb-4">
              Approved files will appear here. Use Approve &amp; Forward from the file detail page to send files to dispatch.
            </p>
            <Button variant="outline" onClick={() => router.push('/files/inbox')}>
              Go to Inbox
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => (
            <Card key={file.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{file.fileNumber}</CardTitle>
                <CardDescription className="line-clamp-2">{file.subject}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {file.department && (
                  <p className="text-xs text-muted-foreground">
                    <DepartmentProfileLink departmentId={file.department.id} name={file.department.name} />
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/files/${file.id}`)}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => openDispatchModal(file)}
                  >
                    <Send className="h-4 w-4" />
                    Dispatch
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dispatchModalOpen} onOpenChange={setDispatchModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dispatch file</DialogTitle>
            <DialogDescription>
              {selectedFile && (
                <>Record dispatch for {selectedFile.fileNumber}: {selectedFile.subject}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Dispatch method *</Label>
              <Select
                value={form.dispatchMethod}
                onValueChange={(v) => setForm((f) => ({ ...f, dispatchMethod: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {DISPATCH_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tracking number</Label>
              <Input
                placeholder="Optional"
                value={form.trackingNumber}
                onChange={(e) => setForm((f) => ({ ...f, trackingNumber: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Recipient name</Label>
              <Input
                placeholder="Optional"
                value={form.recipientName}
                onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Recipient address</Label>
              <Input
                placeholder="Optional"
                value={form.recipientAddress}
                onChange={(e) => setForm((f) => ({ ...f, recipientAddress: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Recipient email</Label>
              <Input
                type="email"
                placeholder="Optional"
                value={form.recipientEmail}
                onChange={(e) => setForm((f) => ({ ...f, recipientEmail: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Proof document (optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Remarks</Label>
              <Input
                placeholder="Optional"
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleDispatchSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/api';
import { toast } from 'sonner';
import { FileText, ArrowLeft, Download, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface DispatchProof {
  id: string;
  fileId: string;
  dispatchDate: string;
  dispatchMethod: string;
  trackingNumber?: string | null;
  recipientName?: string | null;
  remarks?: string | null;
  file?: {
    id: string;
    fileNumber: string;
    subject: string;
    department?: { name: string; code?: string } | null;
  };
  dispatchedBy?: { name: string; username?: string } | null;
}

export default function DispatchHistoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [proofs, setProofs] = useState<DispatchProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchProofs();
  }, [dateFrom, dateTo]);

  const fetchProofs = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const response = await api.get('/dispatch/proofs', { params });
      const data = Array.isArray(response.data) ? response.data : response.data?.data ?? response.data ?? [];
      setProofs(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load dispatch history');
      setProofs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadProof = async (proofId: string, type: 'proof' | 'acknowledgement') => {
    try {
      const res = await api.get(`/dispatch/proofs/${proofId}/download/${type}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `dispatch-${type}-${proofId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Document not available');
    }
  };

  const methodLabel = (m: string) => {
    const map: Record<string, string> = {
      post: 'Post',
      courier: 'Courier',
      hand_delivery: 'Hand delivery',
      email: 'Email',
      other: 'Other',
    };
    return map[m] || m;
  };

  if (loading && proofs.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
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
            onClick={() => router.push('/dispatch')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Dispatch History</h1>
          <p className="text-muted-foreground mt-1">
            Record of dispatched files and proof documents.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by dispatch date range</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchProofs}>
            Apply
          </Button>
        </CardContent>
      </Card>

      {proofs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No dispatch history</h3>
            <p className="text-muted-foreground text-center mb-4">
              Dispatched files will appear here once you dispatch from Ready for Dispatch.
            </p>
            <Button variant="outline" onClick={() => router.push('/dispatch')}>
              Go to Ready for Dispatch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Dispatched by</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proofs.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">
                      {p.dispatchDate ? format(new Date(p.dispatchDate), 'dd MMM yyyy HH:mm') : '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        className="h-auto p-0 font-mono text-sm"
                        onClick={() => router.push(`/files/${p.fileId}`)}
                      >
                        {p.file?.fileNumber ?? p.fileId.slice(0, 8)}
                      </Button>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {p.file?.subject ?? '—'}
                    </TableCell>
                    <TableCell>{methodLabel(p.dispatchMethod)}</TableCell>
                    <TableCell className="max-w-[120px] truncate">
                      {p.recipientName || p.trackingNumber || '—'}
                    </TableCell>
                    <TableCell>{p.dispatchedBy?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownloadProof(p.id, 'proof')}
                        title="Download proof"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

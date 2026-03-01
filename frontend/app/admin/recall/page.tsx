'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { hasGodRole } from '@/lib/auth-utils';
import { AlertTriangle, Search, Shield } from 'lucide-react';

export default function RecallProtocolPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [fileId, setFileId] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!hasGodRole(user)) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            Only Super Admins can access the Recall Protocol. This is a restricted feature.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleRecall = async () => {
    if (!fileId.trim()) {
      toast.error('Please enter a file ID');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/files/${fileId}/recall`);
      toast.success('File recalled successfully', {
        description: `File ${fileId} has been withdrawn from its current stage.`,
      });
      setOpen(false);
      setFileId('');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to recall file', {
        description: err.response?.data?.message || 'The file may not exist or cannot be recalled.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8 text-destructive" />
          Recall Protocol
        </h1>
        <p className="text-muted-foreground mt-2">
          Withdraw any file from any stage of processing. Use with extreme caution.
        </p>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Warning: God Mode Access</AlertTitle>
        <AlertDescription>
          This feature allows you to recall any file from any stage, bypassing normal workflow.
          All recall actions are logged and cannot be undone. Use only in exceptional circumstances.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Recall a File</CardTitle>
          <CardDescription>
            Enter the file ID or file number to recall it from the system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fileId">File ID or File Number</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="fileId"
                value={fileId}
                onChange={(e) => setFileId(e.target.value)}
                placeholder="Enter file ID (e.g., ADMIN/2026/0001)"
                className="pl-9"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && fileId.trim()) {
                    setOpen(true);
                  }
                }}
              />
            </div>
          </div>
          <Button 
            variant="destructive" 
            onClick={() => setOpen(true)} 
            className="w-full"
            disabled={!fileId.trim()}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Recall File
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Recall
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you absolutely sure you want to recall file <strong>{fileId}</strong>?
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive" className="my-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action will immediately withdraw the file from its current stage.
              The file will be unassigned and returned to a pending state.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRecall} 
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Recalling...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Confirm Recall
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

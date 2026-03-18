'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function DocsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  return (
    <div className="container max-w-4xl py-8 px-4">
      <div className="mb-6 flex items-center gap-4">
        {user && (
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to app
          </Button>
        )}
      </div>

      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
          <p className="text-muted-foreground mt-1">
            User guides and reference for the e-Filing system.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card id="user-guide" className="overflow-hidden transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">User Guide</CardTitle>
                  <CardDescription>Complete system documentation for daily use</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Learn how to create files, use the inbox, track files, forward and approve, and manage your workflow.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="default" size="sm">
                  <Link href="/docs#user-guide">View in app</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="/docs/user-guide.pdf" target="_blank" rel="noopener noreferrer">
                    Download PDF (if available)
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card id="api-reference" className="overflow-hidden transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">API Reference</CardTitle>
                  <CardDescription>For developers and integrations</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                REST API endpoints, authentication, and integration notes.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="default" size="sm">
                  <Link href="/docs#api-reference">View in app</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="/docs/api-reference.pdf" target="_blank" rel="noopener noreferrer">
                    Download PDF (if available)
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick start</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <ul className="space-y-2">
              <li><strong>Create a file:</strong> Dashboard or Files → New File. Fill subject, department, and upload attachments in Step 1.</li>
              <li><strong>Inbox:</strong> Files → Inbox. Claim from queue (Inward Desk), or work on assigned files.</li>
              <li><strong>Track a file:</strong> Files → Track File. Search by file number to see journey and history.</li>
              <li><strong>Forward / Approve:</strong> Open a file → use Submit, Forward, or Approve &amp; Forward as per your role.</li>
              <li><strong>Dispatch:</strong> Dispatcher sees Ready for Dispatch; use Dispatch to close and record proof.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

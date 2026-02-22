'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  BookOpen,
  LayoutDashboard,
  FileText,
  Inbox,
  MapPin,
  Users,
  BarChart3,
  MessageSquare,
  Settings,
  Shield,
  Building2,
  GitBranch,
  FolderOpen,
  Send,
  QrCode,
  Activity,
  Globe,
  ListOrdered,
  ExternalLink,
} from 'lucide-react';

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
            {/* Overview */}
            <section id="overview" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                  <CardDescription>
                    EFMP is the central e-filing and document workflow platform for Santhigiri Ashram. It supports creation, routing, approval, tracking, and dispatch of files across departments and divisions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                    <li>File lifecycle: create → assign → process → approve/forward → dispatch</li>
                    <li>Role-based access: Inward Desk, Section Officer, Approval Authority, Dispatcher, Dept Admin, Super Admin, and more</li>
                    <li>Department and division hierarchy (see org structure in deployment)</li>
                    <li>Real-time tracking, capacity management, forward queue when desks are full</li>
                    <li>Opinion requests, chat, workflows, analytics, and document management</li>
                  </ul>
                </CardContent>
              </Card>
            </section>

            {/* Dashboard */}
            <section id="dashboard" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5" />
                    Dashboard
                  </CardTitle>
                  <CardDescription>Route: /dashboard</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    The dashboard shows a summary of the signed-in user&apos;s file statistics and quick access to main actions.
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Stats:</strong> Total files, Pending, In Progress, Approved, Rejected, Red Listed</li>
                    <li><strong>Quick links:</strong> Inbox, New File, Track File, Search</li>
                    <li><strong>Recent files:</strong> List of recently accessed files</li>
                    <li><strong>Role shortcuts:</strong> e.g. Opinion Inbox for Section Officer / Approval Authority</li>
                  </ul>
                </CardContent>
              </Card>
            </section>

            {/* Files & Inbox */}
            <section id="files" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5" />
                    Files & Inbox
                  </CardTitle>
                  <CardDescription>Routes: /files, /files/new, /files/inbox, /files/[id]</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4" /> My Files
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      List of files you created or are assigned to. Filter by status, search by file number or subject, pagination. Click a row to open file detail.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4" /> New File
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      Create a new file: subject, description, department, division, priority, due date, attachments. Available to Inward Desk and admins.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <Inbox className="h-4 w-4" /> Inbox
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      Files assigned to you (and optionally created by you). Quick filters (All, Pending, In Progress, Approved, Red Listed), priority and search. Bulk export and selection. <strong>Forward queue</strong> card at top: when your desk was at capacity, forwarded files wait here; you can <strong>Claim</strong> any file to move it into your inbox.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">File detail (/files/[id])</h4>
                    <p className="text-muted-foreground text-sm mb-2">
                      Full file view with tabs: Details, Notes, History. Attachments (view, download, upload). Actions depend on role and state:
                    </p>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      <li><strong>Forward:</strong> Send to division/department or specific user (receiver capacity and queue message shown)</li>
                      <li><strong>Approve &amp; Forward:</strong> Section Officer / Approval Authority: approve and send to next role in chain</li>
                      <li><strong>Reject / Return:</strong> Return to previous or to host</li>
                      <li><strong>Request extra time:</strong> Request extension; approvers can approve/deny in Extension Requests</li>
                      <li><strong>Recall:</strong> Super Admin only</li>
                      <li>Notes, red-list indicator, priority badge, timer</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Forward & Queue */}
            <section id="forward-queue" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ListOrdered className="h-5 w-5" />
                    Forward &amp; Queue
                  </CardTitle>
                  <CardDescription>Desk capacity and queuing when receiver is full</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    When you forward a file to a user, the system checks the receiver&apos;s desk capacity (inbox count vs max files per day).
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Under capacity:</strong> File goes straight to receiver&apos;s inbox; they get a &quot;New File Assigned&quot; toast.</li>
                    <li><strong>At or over capacity:</strong> File is placed in the receiver&apos;s <strong>Forward queue</strong>. They see &quot;File will be queued&quot; in the forward modal. When they free space (forward/dispatch/recall) or <strong>Claim</strong> a file from the queue, the next file moves from queue to inbox.</li>
                    <li>Receiver can open <strong>Inbox</strong> and use the <strong>Forward queue</strong> card to see all queued files and <strong>Claim</strong> any one to bring it into the inbox (not strictly FIFO).</li>
                  </ul>
                </CardContent>
              </Card>
            </section>

            {/* Track File */}
            <section id="track-file" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Track File
                  </CardTitle>
                  <CardDescription>Routes: /files/track, /files/track/[id]</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    Search and filter files, then open the tracking view for a single file.
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Track list:</strong> Search, filter by status/priority; click to open track detail.</li>
                    <li><strong>Track detail:</strong> Vertical timeline of the file journey: creation and each routing step (forward, approve, return, etc.) with date, remarks, and current location (division/assignee).</li>
                  </ul>
                </CardContent>
              </Card>
            </section>

            {/* Opinion Inbox */}
            <section id="opinions" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Opinion Inbox
                  </CardTitle>
                  <CardDescription>Routes: /opinions/inbox, /opinions/[id]</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    Request and provide opinions on files. Available to Section Officer, Approval Authority, and related roles.
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Received:</strong> Opinion requests sent to you; open to provide opinion and notes, then return.</li>
                    <li><strong>Sent:</strong> Requests you sent; view status and open linked file.</li>
                  </ul>
                </CardContent>
              </Card>
            </section>

            {/* Admin */}
            <section id="admin" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Admin
                  </CardTitle>
                  <CardDescription>Routes: /admin/* — Dept Admin &amp; Super Admin</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <BarChart3 className="h-4 w-4" /> Analytics
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      Dashboard summary, department and user stats, processing time, bottlenecks, activity heatmap; report and export. Desk Performance: executive view (leaderboard, watchlist, metrics).
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4" /> Capacity Management
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      User capacity (max files per day) by user, division, and department; hierarchy view; bulk update. Used for forward queue logic.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4" /> Users
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      List, create, edit, delete users; assign roles and department/division; approve profile; audit logs and activity; presence.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <GitBranch className="h-4 w-4" /> Workflows
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      Define workflows (nodes/edges), validate, publish, clone. Workflow builder: edit graph, start execution, run/pause/resume, view executions. Templates: list, use, export.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">Recall Protocol</h4>
                    <p className="text-muted-foreground text-sm">
                      Super Admin only. Recall a file by ID; file is unassigned and queue for that user can advance.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <QrCode className="h-4 w-4" /> Documents
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      Attachment versions (download, restore, compare); QR for files (generate, scan, scan history); document templates (CRUD, categories).
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Desks &amp; Active Desk</h4>
                    <p className="text-muted-foreground text-sm">
                      Desks: create/edit/delete, capacity, assign, workload. Active Desk: live view of users (presence, department, division), filter by role/department.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Chat */}
            <section id="chat" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Chat
                  </CardTitle>
                  <CardDescription>Routes: /chat, /chat/[id]</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    DMs and group conversations with real-time messaging (Socket.IO).
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>List:</strong> Search, create DM, create group (name, description, members; Chat Manager can filter by department).</li>
                    <li><strong>Conversation:</strong> Messages (paginated), send, real-time updates; member list; export; group management for admins.</li>
                  </ul>
                </CardContent>
              </Card>
            </section>

            {/* Profile & Settings */}
            <section id="profile-settings" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Profile &amp; Settings
                  </CardTitle>
                  <CardDescription>Routes: /profile, /settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    <strong>Profile:</strong> View/edit name, email, bio, phone, department, division; avatar; points/activity; audit.
                  </p>
                  <p>
                    <strong>Settings:</strong> Profile (name, avatar upload); change password; appearance (Light / Dark / System); <strong>Language</strong> (English or Malayalam — see next section).
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* Language */}
            <section id="language" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Language (Malayalam)
                  </CardTitle>
                  <CardDescription>Settings → Language</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    Choose <strong>English</strong> (default) or <strong>മലയാളം (Malayalam)</strong>. When Malayalam is selected, the app uses the <strong>Manjari</strong> font (Google Fonts) for better readability of Malayalam script. The preference is saved and applied across the app; Settings page labels and other translated strings switch to Malayalam.
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* Roles */}
            <section id="roles" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Roles &amp; Access
                  </CardTitle>
                  <CardDescription>Who sees what</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li><strong>INWARD_DESK:</strong> Dashboard; New File, Inbox, Track File.</li>
                    <li><strong>SECTION_OFFICER:</strong> Dashboard; My Files, Inbox, Track File; Opinion Inbox.</li>
                    <li><strong>APPROVAL_AUTHORITY:</strong> Dashboard; Inbox, Pending Approvals, Track File; Opinion Inbox.</li>
                    <li><strong>DISPATCHER:</strong> Dashboard; Dispatch (Ready, History); Track File.</li>
                    <li><strong>USER:</strong> Dashboard; Desk Profile; My Files, Inbox, Track File; Opinion Inbox.</li>
                    <li><strong>CHAT_MANAGER:</strong> Same as User + Chat (Manage Groups).</li>
                    <li><strong>DEPT_ADMIN:</strong> Platform (Dashboard, Files, Opinion Inbox, Analytics); Admin (Desk Management, Workflows, Users, Documents, Capacity); Settings.</li>
                    <li><strong>SUPER_ADMIN:</strong> Same as Dept Admin; plus Recall Protocol; full system access.</li>
                  </ul>
                </CardContent>
              </Card>
            </section>

            {/* API Overview */}
            <section id="api" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    API Overview
                  </CardTitle>
                  <CardDescription>Backend modules (REST)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Main API prefixes and purpose. All authenticated except health/public.
                  </p>
                  <div className="rounded-md border bg-muted/50 p-4 font-mono text-xs space-y-2 overflow-x-auto">
                    <p><strong>auth</strong> — login, register, profile (JWT)</p>
                    <p><strong>users</strong> — CRUD, avatar, audit, activity, presence, password</p>
                    <p><strong>files</strong> — create, list, get, attachments, forward, approve-and-forward, action, request-extra-time, extension-requests, recall, queue (list, claim)</p>
                    <p><strong>capacity</strong> — user/division/department capacity, hierarchy, bulk update</p>
                    <p><strong>departments</strong> — CRUD, divisions, division users</p>
                    <p><strong>opinions</strong> — request, pending/sent, provide, return, notes</p>
                    <p><strong>desks</strong> — CRUD, workload, assign, capacity, performance</p>
                    <p><strong>analytics</strong> — dashboard, departments, users, processing-time, bottlenecks, heatmap, report, executive-dashboard</p>
                    <p><strong>workflows</strong> — CRUD, publish, clone, validate, nodes/edges, execute, executions, templates</p>
                    <p><strong>dispatch</strong> — prepare, dispatch, proof</p>
                    <p><strong>documents</strong> — attachment versions, QR (generate, scan, history), templates</p>
                    <p><strong>chat</strong> — conversations, members, messages, read, export</p>
                    <p><strong>notifications</strong> — list, unread, read, dismiss</p>
                    <p><strong>health</strong> — health, live, ready (unauthenticated)</p>
                  </div>
                </CardContent>
              </Card>
            </section>

      {/* Footer */}
      <footer className="mt-16 pt-8 border-t text-center text-sm text-muted-foreground">
        <p>EFMP — E-Filing Management Platform for Santhigiri Ashram</p>
        <a
          href="/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-primary hover:underline"
        >
          Open EFMP app
          <ExternalLink className="h-4 w-4" />
        </a>
      </footer>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import api from '@/lib/api';
import { MessageSquare, Send, Loader2, Building2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { UserProfileLink } from '@/components/profile-links';
import { Editor } from '@/components/ui/editor';

interface Note {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
}

/** E-File Rules 4 & 5: Notes grouped by process cycle, then by department within cycle */
export interface NoteLogGrouped {
  processCycleId: string | null;
  cycleNumber: number;
  closedAt: string | null;
  notesByDepartment: Array<{
    departmentId: string | null;
    departmentName: string;
    notes: Array<Note & { user?: { id: string; name: string } }>;
  }>;
}

interface FileNotesProps {
  fileId: string;
  notes: Note[];
  noteLogGrouped?: NoteLogGrouped[];
  onNoteAdded?: () => void;
  canEdit?: boolean;
}

export function FileNotes({ fileId, notes: initialNotes, noteLogGrouped, onNoteAdded, canEdit = true }: FileNotesProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const plainText = newNote.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!plainText) {
      toast.error('Please enter a note');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/files/${fileId}/notes`, {
        content: newNote,
      });

      setNotes([response.data, ...notes]);
      setNewNote('');
      toast.success('Note added');
      onNoteAdded?.();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to add note', {
        description: err.response?.data?.message || 'An error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Notes ({notes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Notes List - Grouped by Process Cycle then Department (E-File Rules 4 & 5) */}
        <div className="space-y-4 max-h-[350px] overflow-y-auto">
          {notes.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8 bg-muted/30 rounded-lg">
              No notes yet. Add the first note below.
            </p>
          ) : noteLogGrouped && noteLogGrouped.length > 0 ? (
            <>
              <p className="text-xs text-muted-foreground sticky top-0 bg-background py-1 z-10">
                File note log • grouped by process cycle and department
              </p>
              {noteLogGrouped.map((cycle) => (
                <div key={cycle.processCycleId ?? `cycle-${cycle.cycleNumber}`} className="space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    Process Cycle {cycle.cycleNumber}
                    {cycle.closedAt && (
                      <span className="text-muted-foreground/70 font-normal">
                        (Closed {format(new Date(cycle.closedAt), 'PP')})
                      </span>
                    )}
                  </div>
                  {cycle.notesByDepartment.map((dept) => (
                    <div key={dept.departmentId ?? dept.departmentName} className="rounded-lg border bg-muted/20 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-sm">{dept.departmentName}</span>
                      </div>
                      <div className="divide-y">
                        {dept.notes.map((note) => (
                          <div key={note.id} className="flex gap-3 p-3">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {(note.user?.name ?? '?').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {note.user && (
                                  <UserProfileLink userId={note.user.id} name={note.user.name} className="text-sm" />
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(note.createdAt), 'h:mm a')} | {format(new Date(note.createdAt), 'dd-MMM-yyyy')}
                                </span>
                              </div>
                              <div
                                className="text-sm prose prose-sm dark:prose-invert max-w-none file-rich-text"
                                dangerouslySetInnerHTML={{ __html: note.content }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground sticky top-0 bg-background py-1 z-10">
                {notes.length} note{notes.length !== 1 ? 's' : ''} • Newest first
              </p>
              {notes.map((note) => (
                <div key={note.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 border">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {note.user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <UserProfileLink userId={note.user.id} name={note.user.name} className="text-sm" />
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div
                      className="text-sm prose prose-sm dark:prose-invert max-w-none file-rich-text"
                      dangerouslySetInnerHTML={{ __html: note.content }}
                    />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <Separator />

        {/* Add Note Form - full editor-style textarea */}
        {canEdit ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <Editor
              value={newNote}
              onChange={setNewNote}
              placeholder="Write a detailed note… (@Ai + Ctrl+Enter for AI draft)"
              disabled={loading}
              minHeight="140px"
              inlineAi={{
                fileId,
                fieldHint: 'Internal file note',
              }}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{newNote.length} characters</span>
              <Button
                type="submit"
                disabled={loading || !newNote.trim()}
                className="px-4"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Add Note
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg text-center">
            You can only add notes when the file is assigned to you.
          </div>
        )}
      </CardContent>
    </Card>
  );
}


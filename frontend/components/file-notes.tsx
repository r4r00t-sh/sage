'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import api from '@/lib/api';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { UserProfileLink } from '@/components/profile-links';

interface Note {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
}

interface FileNotesProps {
  fileId: string;
  notes: Note[];
  onNoteAdded?: () => void;
  canEdit?: boolean;
}

export function FileNotes({ fileId, notes: initialNotes, onNoteAdded, canEdit = true }: FileNotesProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newNote.trim()) {
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
        {/* Notes List - Newest notes at top, displayed ABOVE the form */}
        <div className="space-y-3 max-h-[350px] overflow-y-auto">
          {notes.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8 bg-muted/30 rounded-lg">
              No notes yet. Add the first note below.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground sticky top-0 bg-white dark:bg-zinc-900 py-1">
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
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <Separator />

        {/* Add Note Form - Inline style with resizable textarea */}
        {canEdit ? (
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div className="flex-1">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                disabled={loading}
                className="min-h-[42px] max-h-[200px] resize-y"
                style={{ height: '42px' }}
              />
            </div>
            <Button 
              type="submit" 
              disabled={loading || !newNote.trim()}
              className="h-[42px] px-4"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Add Note'
              )}
            </Button>
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


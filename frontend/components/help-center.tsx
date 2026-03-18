'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  HelpCircle,
  Search,
  FileText,
  MessageSquare,
  Video,
  Book,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface HelpArticle {
  id: string;
  title: string;
  category: string;
  content: string;
}

interface VideoTutorial {
  id: string;
  title: string;
  duration: string;
  thumbnail: string;
  url: string;
}

const faqs = [
  {
    question: 'How do I create a new file?',
    answer: 'Click the "Create New File" button in the dashboard or navigate to Files > New. Fill in the required details and upload any necessary attachments.',
  },
  {
    question: 'How do I track a file?',
    answer: 'Use the Track File feature from the dashboard or navigation menu. Enter the file number to see its current status and routing history.',
  },
  {
    question: 'What are gamification points?',
    answer: 'Points are earned by completing tasks like creating files, forwarding them on time, and approving documents. They help track your productivity and engagement.',
  },
  {
    question: 'How do I forward a file?',
    answer: 'Open the file details page and click the "Forward" button. Select the destination desk or user, add optional notes, and confirm the forward action.',
  },
  {
    question: 'What does "Red Listed" mean?',
    answer: 'Red Listed files are overdue and require immediate attention. They appear with a red indicator and are prioritized in your inbox.',
  },
  {
    question: 'How do I use keyboard shortcuts?',
    answer: 'Press "?" to see all available keyboard shortcuts. Use Ctrl+K to open the command palette for quick navigation.',
  },
];

const articles: HelpArticle[] = [
  {
    id: '1',
    title: 'Getting Started Guide',
    category: 'Basics',
    content: 'Learn the fundamentals of the e-Filing system...',
  },
  {
    id: '2',
    title: 'File Management Best Practices',
    category: 'Advanced',
    content: 'Tips for efficient file handling and organization...',
  },
  {
    id: '3',
    title: 'Understanding Workflows',
    category: 'Advanced',
    content: 'How automated workflows streamline your processes...',
  },
];

export function HelpCenter() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredArticles = articles.filter(
    (article) =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-2xl flex items-center gap-2">
            <HelpCircle className="h-6 w-6" />
            Help Center
          </DialogTitle>
          <DialogDescription>
            Find answers, tutorials, and documentation
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs defaultValue="faq" className="flex-1">
          <TabsList className="w-full justify-start rounded-none border-b px-6">
            <TabsTrigger value="faq" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              FAQ
            </TabsTrigger>
            <TabsTrigger value="articles" className="gap-2">
              <FileText className="h-4 w-4" />
              Articles
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-2">
              <Video className="h-4 w-4" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-2">
              <Book className="h-4 w-4" />
              Docs
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px]">
            <TabsContent value="faq" className="p-6 pt-4">
              <Accordion type="single" collapsible className="w-full">
                {filteredFaqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              {filteredFaqs.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    No FAQs found matching your search
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="articles" className="p-6 pt-4 space-y-3">
              {filteredArticles.map((article) => (
                <div
                  key={article.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium group-hover:text-primary transition-colors">
                          {article.title}
                        </h4>
                        <Badge variant="secondary" className="text-xs">
                          {article.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {article.content}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              ))}

              {filteredArticles.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    No articles found matching your search
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="videos" className="p-6 pt-4">
              <div className="text-center py-12">
                <Video className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground mb-4">
                  Video tutorials coming soon
                </p>
                <Button variant="outline" size="sm">
                  Request a Tutorial
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="docs" className="p-6 pt-4">
              <div className="space-y-3">
                <a
                  href="/docs#user-guide"
                  target="_blank"
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <h4 className="font-medium">User Guide</h4>
                      <p className="text-sm text-muted-foreground">
                        Complete system documentation
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </a>

                <a
                  href="/docs#api-reference"
                  target="_blank"
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Book className="h-5 w-5 text-primary" />
                    <div>
                      <h4 className="font-medium">API Reference</h4>
                      <p className="text-sm text-muted-foreground">
                        For developers and integrations
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </a>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="p-6 pt-4 border-t">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Can&apos;t find what you&apos;re looking for?
            </p>
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              Contact Support
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

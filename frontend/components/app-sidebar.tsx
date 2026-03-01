'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { useAvatarUrl } from '@/lib/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  AlertTriangle,
  Settings,
  FilePlus,
  Inbox,
  Clock,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  LogOut,
  User,
  Building2,
  ChevronsUpDown,
  MapPin,
  FileStack,
  QrCode,
  Monitor,
  MessageSquare,
  Send,
  GitBranch,
  FolderOpen,
  Shield,
  FileSearch,
  Activity,
  BookOpen,
  LifeBuoy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Navigation structure with nested items
const navigation = {
  INWARD_DESK: [
    {
      title: 'Platform',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        {
          name: 'Files',
          icon: FolderOpen,
          children: [
            { name: 'New File', href: '/files/new', icon: FilePlus },
            { name: 'Inbox', href: '/files/inbox', icon: Inbox },
            { name: 'Track File', href: '/files/track', icon: MapPin },
          ],
        },
      ],
    },
    {
      title: 'Other',
      items: [
        { name: 'Documentation', href: '/docs', icon: BookOpen },
        { name: 'My tickets', href: '/support', icon: LifeBuoy },
        { name: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ],
  SECTION_OFFICER: [
    {
      title: 'Platform',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        {
          name: 'Files',
          icon: FolderOpen,
          children: [
            { name: 'My Files', href: '/files', icon: FileText },
            { name: 'Inbox', href: '/files/inbox', icon: Inbox },
            { name: 'Track File', href: '/files/track', icon: MapPin },
          ],
        },
        { name: 'Opinion Inbox', href: '/opinions/inbox', icon: MessageSquare },
      ],
    },
    {
      title: 'Other',
      items: [
        { name: 'Documentation', href: '/docs', icon: BookOpen },
        { name: 'My tickets', href: '/support', icon: LifeBuoy },
        { name: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ],
  APPROVAL_AUTHORITY: [
    {
      title: 'Platform',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        {
          name: 'Files',
          icon: FolderOpen,
          children: [
            { name: 'Inbox', href: '/files/inbox', icon: Inbox },
            { name: 'Pending Approvals', href: '/files/approvals', icon: CheckCircle },
            { name: 'Track File', href: '/files/track', icon: MapPin },
          ],
        },
        { name: 'Opinion Inbox', href: '/opinions/inbox', icon: MessageSquare },
      ],
    },
    {
      title: 'Other',
      items: [
        { name: 'Documentation', href: '/docs', icon: BookOpen },
        { name: 'My tickets', href: '/support', icon: LifeBuoy },
        { name: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ],
  DISPATCHER: [
    {
      title: 'Platform',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        {
          name: 'Dispatch',
          icon: Send,
          children: [
            { name: 'Ready for Dispatch', href: '/dispatch', icon: Send },
            { name: 'Dispatch History', href: '/dispatch/history', icon: FileText },
          ],
        },
        { name: 'Track File', href: '/files/track', icon: MapPin },
      ],
    },
    {
      title: 'Other',
      items: [
        { name: 'Documentation', href: '/docs', icon: BookOpen },
        { name: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ],
  USER: [
    {
      title: 'Platform',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Desk Profile', href: '/desk-profile', icon: Activity },
        {
          name: 'Files',
          icon: FolderOpen,
          children: [
            { name: 'My Files', href: '/files', icon: FileText },
            { name: 'Inbox', href: '/files/inbox', icon: Inbox },
            { name: 'Track File', href: '/files/track', icon: MapPin },
          ],
        },
        { name: 'Opinion Inbox', href: '/opinions/inbox', icon: MessageSquare },
      ],
    },
  ],
  CHAT_MANAGER: [
    {
      title: 'Platform',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        {
          name: 'Files',
          icon: FolderOpen,
          children: [
            { name: 'My Files', href: '/files', icon: FileText },
            { name: 'Inbox', href: '/files/inbox', icon: Inbox },
            { name: 'Track File', href: '/files/track', icon: MapPin },
          ],
        },
        { name: 'Opinion Inbox', href: '/opinions/inbox', icon: MessageSquare },
      ],
    },
    {
      title: 'Other',
      items: [
        { name: 'Documentation', href: '/docs', icon: BookOpen },
        { name: 'Settings', href: '/settings', icon: Settings },
      ],
    },
    {
      title: 'Chat Admin',
      items: [
        { name: 'Manage Groups', href: '/chat', icon: Users },
      ],
    },
  ],
  DEPT_ADMIN: [
    {
      title: 'Platform',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        {
          name: 'Files',
          icon: FolderOpen,
          children: [
            { name: 'New File', href: '/files/new', icon: FilePlus },
            { name: 'Inbox', href: '/files/inbox', icon: Inbox },
            { name: 'Track File', href: '/files/track', icon: MapPin },
          ],
        },
        { name: 'Opinion Inbox', href: '/opinions/inbox', icon: MessageSquare },
        {
          name: 'Analytics',
          icon: BarChart3,
          children: [
            { name: 'Overview', href: '/admin/analytics', icon: BarChart3 },
            { name: 'Desk Performance', href: '/admin/analytics/desk-performance', icon: Activity },
          ],
        },
      ],
    },
      {
        title: 'Admin',
        items: [
          {
            name: 'Desk Management',
            icon: Monitor,
            children: [
              { name: 'Active Desk', href: '/admin/desk', icon: Monitor },
              { name: 'Desk Capacity', href: '/admin/desks', icon: Building2 },
              { name: 'Capacity Management', href: '/admin/capacity', icon: Settings },
            ],
          },
          { name: 'Workflows', href: '/admin/workflows', icon: GitBranch },
          { name: 'Users', href: '/admin/users', icon: Users },
          { name: 'Departments', href: '/admin/departments', icon: Building2 },
          { name: 'Documents', href: '/admin/documents', icon: FileStack },
          { name: 'Support Panel', href: '/support?supportView=true', icon: LifeBuoy },
        ],
      },
    {
      title: 'Other',
      items: [
        { name: 'Documentation', href: '/docs', icon: BookOpen },
        { name: 'My tickets', href: '/support', icon: LifeBuoy },
        { name: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ],
  DEVELOPER: [
    {
      title: 'Platform',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        {
          name: 'Files',
          icon: FolderOpen,
          children: [
            { name: 'New File', href: '/files/new', icon: FilePlus },
            { name: 'Inbox', href: '/files/inbox', icon: Inbox },
            { name: 'Track File', href: '/files/track', icon: MapPin },
          ],
        },
        { name: 'Opinion Inbox', href: '/opinions/inbox', icon: MessageSquare },
        {
          name: 'Analytics',
          icon: BarChart3,
          children: [
            { name: 'Overview', href: '/admin/analytics', icon: BarChart3 },
            { name: 'Desk Performance', href: '/admin/analytics/desk-performance', icon: Activity },
          ],
        },
      ],
    },
    {
      title: 'Admin',
      items: [
        {
          name: 'Desk Management',
          icon: Monitor,
          children: [
            { name: 'Active Desk', href: '/admin/desk', icon: Monitor },
            { name: 'Desk Capacity', href: '/admin/desks', icon: Building2 },
          ],
        },
        { name: 'Workflows', href: '/admin/workflows', icon: GitBranch },
        { name: 'Users', href: '/admin/users', icon: Users },
        { name: 'Departments', href: '/admin/departments', icon: Building2 },
        { name: 'Documents', href: '/admin/documents', icon: FileStack },
        { name: 'Recall Protocol', href: '/admin/recall', icon: AlertTriangle },
        { name: 'Support Panel', href: '/support?supportView=true', icon: LifeBuoy },
      ],
    },
    {
      title: 'Other',
      items: [
        { name: 'Documentation', href: '/docs', icon: BookOpen },
        { name: 'My tickets', href: '/support', icon: LifeBuoy },
        { name: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ],
  SUPER_ADMIN: [
    {
      title: 'Platform',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        {
          name: 'Files',
          icon: FolderOpen,
          children: [
            { name: 'New File', href: '/files/new', icon: FilePlus },
            { name: 'Inbox', href: '/files/inbox', icon: Inbox },
            { name: 'Track File', href: '/files/track', icon: MapPin },
          ],
        },
        { name: 'Opinion Inbox', href: '/opinions/inbox', icon: MessageSquare },
        {
          name: 'Analytics',
          icon: BarChart3,
          children: [
            { name: 'Overview', href: '/admin/analytics', icon: BarChart3 },
            { name: 'Desk Performance', href: '/admin/analytics/desk-performance', icon: Activity },
          ],
        },
      ],
    },
    {
      title: 'Admin',
      items: [
        {
          name: 'Desk Management',
          icon: Monitor,
          children: [
            { name: 'Active Desk', href: '/admin/desk', icon: Monitor },
            { name: 'Desk Capacity', href: '/admin/desks', icon: Building2 },
          ],
        },
        { name: 'Workflows', href: '/admin/workflows', icon: GitBranch },
        { name: 'Users', href: '/admin/users', icon: Users },
        { name: 'Departments', href: '/admin/departments', icon: Building2 },
        { name: 'Documents', href: '/admin/documents', icon: FileStack },
        { name: 'Recall Protocol', href: '/admin/recall', icon: AlertTriangle },
        { name: 'Support Panel', href: '/support?supportView=true', icon: LifeBuoy },
      ],
    },
    {
      title: 'Other',
      items: [
        { name: 'Documentation', href: '/docs', icon: BookOpen },
        { name: 'My tickets', href: '/support', icon: LifeBuoy },
        { name: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ],
  SUPPORT: [
    {
      title: 'Platform',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Support Panel', href: '/support?supportView=true', icon: LifeBuoy },
      ],
    },
    {
      title: 'Other',
      items: [
        { name: 'Documentation', href: '/docs', icon: BookOpen },
        { name: 'My tickets', href: '/support', icon: LifeBuoy },
        { name: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ],
};

type NavItem = { name: string; href?: string; icon: React.ComponentType<{ className?: string }>; children?: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[] };

export function AppSidebar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'Files': true,
    'Desk Management': false,
  });

  const avatarUrl = useAvatarUrl(user?.id, user?.avatarKey ?? null);

  if (!user) return null;

  const primaryRole = (user as { roles?: string[]; role?: string }).roles?.[0] ?? (user as { role?: string }).role ?? 'SECTION_OFFICER';
  const userNav = navigation[primaryRole as keyof typeof navigation] || navigation.SECTION_OFFICER;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleItem = (name: string) => {
    setOpenItems(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const isItemActive = (item: NavItem): boolean => {
    if (item.href) {
      return pathname === item.href || pathname?.startsWith(item.href + '/');
    }
    if (item.children) {
      return item.children.some((child) =>
        pathname === child.href || pathname?.startsWith(child.href + '/')
      );
    }
    return false;
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="h-14 flex items-center justify-start border-b px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:gap-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9">
            <img
              src="/logo.png?v=2"
              alt="SAGE"
              className="h-11 w-11 object-contain group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9"
            />
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2">
        {userNav.map((group) => (
          <SidebarGroup key={group.title} className="py-2">
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold px-2 mb-1">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const hasChildren = 'children' in item && item.children;
                  const isActive = isItemActive(item);
                  const isOpen = openItems[item.name] ?? false;

                  if (hasChildren) {
                    return (
                      <Collapsible
                        key={item.name}
                        open={isOpen}
                        onOpenChange={() => toggleItem(item.name)}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              tooltip={item.name}
                              className={cn(
                                "w-full justify-between group-data-[collapsible=icon]:justify-center transition-colors",
                                isActive && "bg-accent text-accent-foreground font-medium"
                              )}
                            >
                              <div className="flex items-center gap-2 group-data-[collapsible=icon]:gap-0">
                                <Icon className="h-4 w-4 shrink-0" />
                                <span>{item.name}</span>
                              </div>
                              <ChevronRight className={cn(
                                "h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
                                isOpen && "rotate-90"
                              )} />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="CollapsibleContent">
                            <SidebarMenuSub className="ml-4 border-l border-border/50 pl-2 mt-1">
                              {item.children.map((child) => {
                                const ChildIcon = child.icon;
                                const childActive = pathname === child.href || pathname?.startsWith(child.href + '/');
                                return (
                                  <SidebarMenuSubItem key={child.name}>
                                    <SidebarMenuSubButton
                                      asChild
                                      isActive={childActive}
                                      className={cn(
                                        "transition-colors",
                                        childActive && "bg-primary/10 text-primary font-medium"
                                      )}
                                    >
                                      <a href={child.href} className="flex items-center gap-2">
                                        <ChildIcon className="h-3.5 w-3.5" />
                                        <span className="text-[13px]">{child.name}</span>
                                      </a>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.name}
                        className={cn(
                          "transition-colors",
                          isActive && "bg-primary/10 text-primary font-medium"
                        )}
                      >
                        <a
                          href={item.href}
                          {...(item.href === '/docs' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      
      <SidebarFooter className="border-t p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-accent transition-colors group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>div:first-child]:!flex group-data-[collapsible=icon]:[&>div:first-child>*]:!flex"
            >
              {/* First div: avatar wrapper. Override sidebar's [&>div>span]:hidden so avatar shows when collapsed */}
              <div className="shrink-0 flex items-center justify-center group-data-[collapsible=icon]:size-8">
                <Avatar className="h-8 w-8 rounded-lg group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
                  <AvatarImage src={avatarUrl ?? undefined} alt={user.name} />
                  <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {user.username}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side="top"
            align="start"
            sideOffset={8}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                <Avatar className="h-9 w-9 rounded-lg">
                  <AvatarImage src={avatarUrl ?? undefined} alt={user.name} />
                  <AvatarFallback className="rounded-lg bg-primary text-primary-foreground font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email || user.username}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/profile')} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

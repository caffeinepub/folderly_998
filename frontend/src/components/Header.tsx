import { useState } from "react";
import { FolderTree, Pencil, LogOut, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { EditNameDialog } from "./EditNameDialog";
import { TagManagementDialog } from "./TagManagementDialog";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

interface HeaderProps {
  userName: string;
}

export function Header({ userName }: HeaderProps) {
  const queryClient = useQueryClient();
  const { clear } = useInternetIdentity();
  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [tagManagementOpen, setTagManagementOpen] = useState(false);

  const handleLogout = () => {
    queryClient.clear();
    clear();
  };

  return (
    <>
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <FolderTree className="w-5 h-5 text-primary" />
          <span className="text-lg font-semibold text-foreground">
            Folderly
          </span>
        </div>

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full p-0"
            >
              <Avatar className="h-9 w-9 cursor-pointer">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Welcome back, {userName}!</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setEditNameDialogOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit Name
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTagManagementOpen(true)}>
              <Tags className="h-4 w-4" />
              Manage Tags
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <EditNameDialog
        open={editNameDialogOpen}
        onOpenChange={setEditNameDialogOpen}
        currentName={userName}
      />

      <TagManagementDialog
        open={tagManagementOpen}
        onOpenChange={setTagManagementOpen}
      />
    </>
  );
}

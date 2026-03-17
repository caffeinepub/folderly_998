import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Folder, Home } from "lucide-react";
import { useMoveFile, useGetAllFolders } from "../hooks/useQueries";
import { toast } from "sonner";
import type { FileMetadata, Folder as FolderType, FolderId } from "@/backend";

interface MoveFileDialogProps {
  file: FileMetadata | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoveFileDialog({
  file,
  open,
  onOpenChange,
}: MoveFileDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<FolderId | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const { mutate: moveFile, isPending } = useMoveFile();
  const { data: allFolders = [], isError: isFoldersError } = useGetAllFolders();

  useEffect(() => {
    if (file) {
      setSelectedFolderId(file.folderId ?? null);
      setError(null);
    }
  }, [file]);

  const handleSubmit = () => {
    if (!file) return;

    // Don't move if destination is the same as current
    const currentFolderId = file.folderId ?? null;
    if (selectedFolderId === currentFolderId) {
      onOpenChange(false);
      return;
    }

    setError(null);
    moveFile(
      { id: file.id, newFolderId: selectedFolderId },
      {
        onSuccess: () => {
          toast.success("File moved");
          onOpenChange(false);
        },
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to move file");
        },
      },
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError(null);
    }
    onOpenChange(open);
  };

  // Build folder tree structure
  const buildFolderTree = (parentId: FolderId | null): FolderType[] => {
    return allFolders
      .filter((f) => (f.parentId ?? null) === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  // Recursive folder item component
  const FolderItem = ({
    folder,
    depth = 0,
  }: {
    folder: FolderType;
    depth?: number;
  }) => {
    const children = buildFolderTree(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const isCurrent = file?.folderId === folder.id;

    return (
      <div>
        <button
          type="button"
          onClick={() => setSelectedFolderId(folder.id)}
          className={`
            w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md transition-colors
            ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"}
            ${isCurrent ? "opacity-50" : ""}
          `}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <Folder className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1">{folder.name}</span>
          {isCurrent && <span className="text-xs opacity-70">(current)</span>}
        </button>
        {children.map((child) => (
          <FolderItem key={child.id} folder={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  const rootFolders = buildFolderTree(null);
  const isRootSelected = selectedFolderId === null;
  const isCurrentRoot = !file?.folderId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move File</DialogTitle>
          <DialogDescription>
            Select a destination folder for "{file?.name}".
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isFoldersError ? (
            <div className="text-destructive py-4 text-center">
              Failed to load folders. Please refresh.
            </div>
          ) : (
            <div className="border border-border rounded-lg">
              <ScrollArea className="h-[300px]">
                {/* Root option */}
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-t-md transition-colors
                    ${isRootSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"}
                    ${isCurrentRoot ? "opacity-50" : ""}
                  `}
                >
                  <Home className="h-4 w-4 shrink-0" />
                  <span className="flex-1">Root (no folder)</span>
                  {isCurrentRoot && (
                    <span className="text-xs opacity-70">(current)</span>
                  )}
                </button>

                {/* Folder tree */}
                {rootFolders.map((folder) => (
                  <FolderItem key={folder.id} folder={folder} />
                ))}

                {rootFolders.length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    No folders yet
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

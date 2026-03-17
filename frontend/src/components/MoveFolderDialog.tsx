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
import { useMoveFolder, useGetAllFolders } from "../hooks/useQueries";
import { toast } from "sonner";
import type { Folder as FolderType, FolderId } from "@/backend";

interface MoveFolderDialogProps {
  folder: FolderType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Build set of folder IDs that are descendants of the moving folder
function getDescendantIds(
  folderId: bigint,
  allFolders: FolderType[],
): Set<bigint> {
  const descendants = new Set<bigint>();
  const queue = [folderId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const folder of allFolders) {
      if (folder.parentId === currentId && !descendants.has(folder.id)) {
        descendants.add(folder.id);
        queue.push(folder.id);
      }
    }
  }
  return descendants;
}

export function MoveFolderDialog({
  folder,
  open,
  onOpenChange,
}: MoveFolderDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<FolderId | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const { mutate: moveFolder, isPending } = useMoveFolder();
  const { data: allFolders = [], isError: isFoldersError } = useGetAllFolders();

  // Get invalid destination IDs (the folder itself and all its descendants)
  const invalidIds = folder
    ? new Set([folder.id, ...getDescendantIds(folder.id, allFolders)])
    : new Set<bigint>();

  useEffect(() => {
    if (folder) {
      setSelectedFolderId(folder.parentId ?? null);
      setError(null);
    }
  }, [folder]);

  const handleSubmit = () => {
    if (!folder) return;

    // Don't move if destination is the same as current
    const currentParentId = folder.parentId ?? null;
    if (selectedFolderId === currentParentId) {
      onOpenChange(false);
      return;
    }

    setError(null);
    moveFolder(
      { id: folder.id, newParentId: selectedFolderId },
      {
        onSuccess: () => {
          toast.success("Folder moved");
          onOpenChange(false);
        },
        onError: (err: unknown) => {
          setError(
            err instanceof Error ? err.message : "Failed to move folder",
          );
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

  // Build folder tree structure, excluding invalid destinations
  const buildFolderTree = (parentId: FolderId | null): FolderType[] => {
    return allFolders
      .filter((f) => (f.parentId ?? null) === parentId && !invalidIds.has(f.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  // Recursive folder item component
  const FolderItem = ({
    folderItem,
    depth = 0,
  }: {
    folderItem: FolderType;
    depth?: number;
  }) => {
    const children = buildFolderTree(folderItem.id);
    const isSelected = selectedFolderId === folderItem.id;
    const isCurrent = folder?.parentId === folderItem.id;

    return (
      <div>
        <button
          type="button"
          onClick={() => setSelectedFolderId(folderItem.id)}
          className={`
            w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md transition-colors
            ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"}
            ${isCurrent ? "opacity-50" : ""}
          `}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <Folder className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1">{folderItem.name}</span>
          {isCurrent && <span className="text-xs opacity-70">(current)</span>}
        </button>
        {children.map((child) => (
          <FolderItem key={child.id} folderItem={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  const rootFolders = buildFolderTree(null);
  const isRootSelected = selectedFolderId === null;
  const isCurrentRoot = !folder?.parentId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move Folder</DialogTitle>
          <DialogDescription>
            Select a destination for "{folder?.name}".
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
                {rootFolders.map((folderItem) => (
                  <FolderItem key={folderItem.id} folderItem={folderItem} />
                ))}

                {rootFolders.length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    No valid destinations
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

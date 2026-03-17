import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import {
  useGetAllTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
} from "../hooks/useQueries";
import { toast } from "sonner";
import { TAG_COLORS } from "@/utils/constants";
import type { Tag, TagId } from "@/backend";

interface TagManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TagManagementDialog({
  open,
  onOpenChange,
}: TagManagementDialogProps) {
  const { data: tags = [], isLoading, isError } = useGetAllTags();
  const { mutateAsync: createTag, isPending: isCreating } = useCreateTag();
  const { mutateAsync: updateTag, isPending: isUpdating } = useUpdateTag();
  const { mutateAsync: deleteTag, isPending: isDeleting } = useDeleteTag();

  const [editingTag, setEditingTag] = useState<TagId | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  const isPending = isCreating || isUpdating || isDeleting;

  const startEditing = (tag: Tag) => {
    setEditingTag(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEditing = () => {
    setEditingTag(null);
    setEditName("");
    setEditColor("");
  };

  const handleSaveEdit = async () => {
    if (!editingTag || !editName.trim()) return;

    try {
      await updateTag({
        id: editingTag,
        name: editName.trim(),
        color: editColor,
      });
      toast.success("Tag updated");
      cancelEditing();
    } catch {
      toast.error("Failed to update tag");
    }
  };

  const handleDelete = async () => {
    if (!tagToDelete) return;

    try {
      await deleteTag(tagToDelete.id);
      toast.success("Tag deleted");
    } catch {
      toast.error("Failed to delete tag");
    } finally {
      setTagToDelete(null);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      await createTag({ name: newTagName.trim(), color: newTagColor });
      toast.success("Tag created");
      setNewTagName("");
      setNewTagColor(TAG_COLORS[0]);
      setShowNewTagForm(false);
    } catch {
      toast.error("Failed to create tag");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>
            Create, edit, and organize your tags. Changes apply to all files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Create new tag */}
          {showNewTagForm ? (
            <div className="border border-border rounded-lg p-3 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  maxLength={50}
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || isCreating}
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setShowNewTagForm(false);
                    setNewTagName("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    className={`w-6 h-6 rounded-full transition-all ${
                      newTagColor === color
                        ? "ring-2 ring-offset-2 ring-primary"
                        : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowNewTagForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Tag
            </Button>
          )}

          {/* Tag list */}
          {isError ? (
            <div className="text-destructive py-4 text-center">
              Failed to load tags. Please refresh.
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tags.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No tags yet. Create one to get started.
            </p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-muted/50"
                  >
                    {editingTag === tag.id ? (
                      <>
                        {/* Editing mode */}
                        <div className="flex-1 space-y-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            maxLength={50}
                            autoFocus
                          />
                          <div className="flex flex-wrap gap-1.5">
                            {TAG_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setEditColor(color)}
                                className={`w-5 h-5 rounded-full transition-all ${
                                  editColor === color
                                    ? "ring-2 ring-offset-1 ring-primary"
                                    : ""
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleSaveEdit}
                          disabled={!editName.trim() || isUpdating}
                        >
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={cancelEditing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {/* Display mode */}
                        <div
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 text-sm font-medium truncate">
                          {tag.name}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startEditing(tag)}
                          disabled={isPending}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setTagToDelete(tag)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>

      <AlertDialog
        open={!!tagToDelete}
        onOpenChange={() => setTagToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{tagToDelete?.name}"? It will be
              removed from all files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

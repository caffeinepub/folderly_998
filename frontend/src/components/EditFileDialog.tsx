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
import { Loader2, X, Plus, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  useUpdateFile,
  useGetAllTags,
  useCreateTag,
} from "../hooks/useQueries";
import { TagManagementDialog } from "./TagManagementDialog";
import { toast } from "sonner";
import { TAG_COLORS } from "@/utils/constants";
import type { FileMetadata, Tag, TagId } from "@/backend";

interface EditFileDialogProps {
  file: FileMetadata | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditFileDialog({
  file,
  open,
  onOpenChange,
}: EditFileDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<TagId[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showTagManagement, setShowTagManagement] = useState(false);

  const { mutate: updateFile, isPending: isUpdating } = useUpdateFile();
  const { mutateAsync: createTag, isPending: isCreatingTag } = useCreateTag();
  const { data: allTags = [], isError: isTagsError } = useGetAllTags();

  const isPending = isUpdating || isCreatingTag;

  // Reset form when file changes
  useEffect(() => {
    if (file) {
      setName(file.name);
      setDescription(file.description);
      setSelectedTagIds([...file.tagIds]);
      setNewTagName("");
      setError(null);
    }
  }, [file]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) return;
    setError(null);
    updateFile(
      {
        id: file.id,
        name: name.trim(),
        description: description.trim(),
        tagIds: selectedTagIds,
      },
      {
        onSuccess: () => {
          toast.success("File updated");
          onOpenChange(false);
        },
        onError: (err: unknown) => {
          setError(
            err instanceof Error ? err.message : "Failed to update file",
          );
        },
      },
    );
  };

  const handleAddExistingTag = (tagId: TagId) => {
    if (!selectedTagIds.includes(tagId)) {
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
  };

  const handleCreateAndAddTag = async () => {
    const tagName = newTagName.trim();
    if (!tagName) return;

    // Check if tag with this name already exists
    const existingTag = allTags.find(
      (t) => t.name.toLowerCase() === tagName.toLowerCase(),
    );
    if (existingTag) {
      handleAddExistingTag(existingTag.id);
      setNewTagName("");
      return;
    }

    try {
      // Pick a random color
      const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
      const newTag = await createTag({ name: tagName, color });
      setSelectedTagIds([...selectedTagIds, newTag.id]);
      setNewTagName("");
    } catch (err) {
      toast.error("Failed to create tag");
    }
  };

  const handleRemoveTag = (tagId: TagId) => {
    setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateAndAddTag();
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError(null);
    }
    onOpenChange(open);
  };

  // Get tag objects for selected IDs
  const selectedTags = selectedTagIds
    .map((id) => allTags.find((t) => t.id === id))
    .filter((t): t is Tag => t !== undefined);

  // Available tags (not yet selected)
  const availableTags = allTags.filter((t) => !selectedTagIds.includes(t.id));

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit File</DialogTitle>
              <DialogDescription>
                Update file name, description, and tags.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Name */}
              <div className="grid gap-2">
                <Label htmlFor="file-name">Name</Label>
                <Input
                  id="file-name"
                  placeholder="Enter file name"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setName(e.target.value)
                  }
                  maxLength={200}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div className="grid gap-2">
                <Label htmlFor="file-description">Description</Label>
                <Textarea
                  id="file-description"
                  placeholder="Enter file description (optional)"
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setDescription(e.target.value)
                  }
                  maxLength={500}
                  rows={3}
                />
              </div>

              {/* Tags */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Tags</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto py-0.5 px-1.5 text-xs text-muted-foreground"
                    onClick={() => setShowTagManagement(true)}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Manage
                  </Button>
                </div>

                {isTagsError && (
                  <div className="text-destructive text-sm">
                    Failed to load tags.
                  </div>
                )}

                {/* Selected tags */}
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTags.map((tag) => (
                      <Badge
                        key={tag.id}
                        style={{ backgroundColor: tag.color, color: "#fff" }}
                        className="gap-1 pr-1"
                      >
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag.id)}
                          className="ml-1 hover:bg-black/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Add new tag */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Create or search tags"
                    value={newTagName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewTagName(e.target.value)
                    }
                    onKeyDown={handleKeyDown}
                    maxLength={50}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCreateAndAddTag}
                    disabled={!newTagName.trim() || isCreatingTag}
                  >
                    {isCreatingTag ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Available tags */}
                {availableTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags
                      .filter(
                        (t) =>
                          !newTagName ||
                          t.name
                            .toLowerCase()
                            .includes(newTagName.toLowerCase()),
                      )
                      .slice(0, 10)
                      .map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          style={{ borderColor: tag.color, color: tag.color }}
                          className="cursor-pointer hover:opacity-80"
                          onClick={() => handleAddExistingTag(tag.id)}
                        >
                          + {tag.name}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
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
              <Button type="submit" disabled={!name.trim() || isPending}>
                {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                {isUpdating ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TagManagementDialog
        open={showTagManagement}
        onOpenChange={setShowTagManagement}
      />
    </>
  );
}

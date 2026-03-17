import { useState, useCallback, useRef } from "react";
import {
  FileIcon,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  Folder,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  FolderOpen,
  FolderInput,
  Loader2,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  useDeleteFile,
  useDeleteFolder,
  useGetAllFolders,
  useGetAllTags,
} from "@/hooks/useQueries";
import { useActor } from "@/hooks/useActor";
import { formatFileSize, formatDate } from "@/utils/formatting";
import { downloadFolderAsZip } from "@/utils/exports";
import { useDownloadFile } from "@/hooks/useDownloadFile";
import { EditFileDialog } from "./EditFileDialog";
import { RenameFolderDialog } from "./RenameFolderDialog";
import { MoveFileDialog } from "./MoveFileDialog";
import { MoveFolderDialog } from "./MoveFolderDialog";
import { FilePreviewDialog } from "./FilePreviewDialog";
import type { FileMetadata, Folder as FolderType } from "@/backend";

type ViewMode = "list" | "grid";

interface FileListProps {
  folders: FolderType[];
  files: FileMetadata[];
  isLoading: boolean;
  selectedFile: FileMetadata | null;
  onSelectFile: (file: FileMetadata | null) => void;
  onOpenFolder: (folderId: bigint) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

type SortField = "name" | "size" | "date" | "type" | "tag";
type SortOrder = "asc" | "desc";

export function FileList({
  folders,
  files,
  isLoading,
  selectedFile,
  onSelectFile,
  onOpenFolder,
  viewMode: controlledViewMode,
  onViewModeChange,
}: FileListProps) {
  const [fileToDelete, setFileToDelete] = useState<FileMetadata | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderType | null>(null);
  const [fileToEdit, setFileToEdit] = useState<FileMetadata | null>(null);
  const [folderToRename, setFolderToRename] = useState<FolderType | null>(null);
  const [fileToMove, setFileToMove] = useState<FileMetadata | null>(null);
  const [folderToMove, setFolderToMove] = useState<FolderType | null>(null);
  const [fileToPreview, setFileToPreview] = useState<FileMetadata | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [downloadingFolder, setDownloadingFolder] = useState<bigint | null>(
    null,
  );
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>("list");
  const { download: handleDownloadFile, downloadingFileId } = useDownloadFile();

  // Double-tap detection for mobile/touch devices
  const lastTapTimeRef = useRef<number>(0);
  const handleDoubleTap = (callback: () => void) => (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapTimeRef.current < 300) {
      e.preventDefault();
      callback();
    }
    lastTapTimeRef.current = now;
  };

  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;
  const { mutateAsync: deleteFile, isPending: isDeletingFile } =
    useDeleteFile();
  const { mutateAsync: deleteFolder, isPending: isDeletingFolder } =
    useDeleteFolder();
  const { actor } = useActor();
  const { data: allFolders = [], isError: isFoldersError } = useGetAllFolders();
  const { data: allTags = [], isError: isTagsError } = useGetAllTags();

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return FileImage;
    if (fileType.startsWith("video/")) return FileVideo;
    if (fileType.startsWith("audio/")) return FileAudio;
    if (fileType.startsWith("text/")) return FileText;
    if (
      fileType.includes("zip") ||
      fileType.includes("rar") ||
      fileType.includes("tar")
    )
      return FileArchive;
    return FileIcon;
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    try {
      await deleteFile(fileToDelete.id);
      toast.success("File deleted successfully");
      if (selectedFile?.id === fileToDelete.id) {
        onSelectFile(null);
      }
    } catch (error) {
      toast.error("Failed to delete file");
    } finally {
      setFileToDelete(null);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;
    try {
      await deleteFolder(folderToDelete.id);
      toast.success("Folder deleted successfully");
    } catch (error) {
      toast.error("Failed to delete folder");
    } finally {
      setFolderToDelete(null);
    }
  };

  const handleDownloadFolder = useCallback(
    async (folder: FolderType) => {
      if (!actor || downloadingFolder) return;

      setDownloadingFolder(folder.id);
      const toastId = toast.loading(`Preparing ${folder.name}.zip...`);

      try {
        // Get all files in folder (including subfolders)
        const files = await actor.getAllFilesInFolder(folder.id);

        if (files.length === 0) {
          toast.dismiss(toastId);
          toast.error("Folder is empty");
          setDownloadingFolder(null);
          return;
        }

        await downloadFolderAsZip(
          folder.id,
          folder.name,
          files,
          allFolders,
          (progress) => {
            toast.loading(
              `Downloading: ${progress.filesProcessed}/${progress.totalFiles} files`,
              { id: toastId },
            );
          },
        );

        toast.dismiss(toastId);
        toast.success(`${folder.name}.zip downloaded`);
      } catch (error) {
        toast.dismiss(toastId);
        toast.error("Failed to download folder");
        console.error("Download folder error:", error);
      } finally {
        setDownloadingFolder(null);
      }
    },
    [actor, downloadingFolder, allFolders],
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedFolders = [...folders].sort((a, b) => {
    let comparison = 0;
    if (sortField === "name") {
      comparison = a.name.localeCompare(b.name);
    } else if (sortField === "date") {
      comparison = Number(a.createdDate - b.createdDate);
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const sortedFiles = [...files].sort((a, b) => {
    let comparison = 0;
    if (sortField === "name") {
      comparison = a.name.localeCompare(b.name);
    } else if (sortField === "size") {
      comparison = Number(a.size - b.size);
    } else if (sortField === "date") {
      comparison = Number(a.uploadDate - b.uploadDate);
    } else if (sortField === "type") {
      comparison = a.fileType.localeCompare(b.fileType);
    } else if (sortField === "tag") {
      const aFirstTag =
        allTags.find((t) => a.tagIds.includes(t.id))?.name || "";
      const bFirstTag =
        allTags.find((t) => b.tagIds.includes(t.id))?.name || "";
      // Files without tags go last
      if (!aFirstTag && bFirstTag) return sortOrder === "asc" ? 1 : -1;
      if (aFirstTag && !bFirstTag) return sortOrder === "asc" ? -1 : 1;
      comparison = aFirstTag.localeCompare(bFirstTag);
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  if (isFoldersError || isTagsError) {
    return (
      <div className="text-destructive p-4">
        Failed to load data. Please refresh.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="inline-flex p-4 rounded-full bg-muted/50 mb-4">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">This folder is empty</h3>
        <p className="text-sm text-muted-foreground">
          Upload files or create folders to get started
        </p>
      </div>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />;
    }
    return sortOrder === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const ViewToggleHeader = () => (
    <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
      <div className="flex items-center gap-2">
        {viewMode === "grid" && (
          <>
            <Select
              value={sortField}
              onValueChange={(value) => setSortField(value as SortField)}
            >
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="size">Size</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="type">Type</SelectItem>
                <SelectItem value="tag">Tag</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="h-8 px-2"
            >
              {sortOrder === "asc" ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
      </div>
      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(value) => value && setViewMode(value as ViewMode)}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="list" aria-label="List view">
          <LayoutList className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="grid" aria-label="Grid view">
          <LayoutGrid className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );

  return (
    <>
      <ViewToggleHeader />

      {viewMode === "grid" ? (
        // Grid view
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {/* Folders */}
          {sortedFolders.map((folder) => (
            <div
              key={`folder-${folder.id}`}
              onDoubleClick={() => onOpenFolder(folder.id)}
              onTouchEnd={handleDoubleTap(() => onOpenFolder(folder.id))}
              className="group relative flex flex-col items-center p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-all"
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onOpenFolder(folder.id)}>
                    <FolderOpen className="h-4 w-4" />
                    Open
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDownloadFolder(folder)}
                    disabled={downloadingFolder === folder.id}
                  >
                    {downloadingFolder === folder.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download as ZIP
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFolderToRename(folder)}>
                    <Pencil className="h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFolderToMove(folder)}>
                    <FolderInput className="h-4 w-4" />
                    Move
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setFolderToDelete(folder)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 mb-2">
                <Folder className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm font-medium text-center truncate w-full">
                {folder.name}
              </p>
              <p className="text-xs text-muted-foreground">Folder</p>
            </div>
          ))}

          {/* Files */}
          {sortedFiles.map((file) => {
            const Icon = getFileIcon(file.fileType);
            const isSelected = selectedFile?.id === file.id;
            const isImage = file.fileType.startsWith("image/");
            return (
              <div
                key={`file-${file.id}`}
                onClick={() => onSelectFile(file)}
                onDoubleClick={() => setFileToPreview(file)}
                onTouchEnd={handleDoubleTap(() => setFileToPreview(file))}
                className={`group relative flex flex-col items-center p-4 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border/50 hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleDownloadFile(file)}
                      disabled={downloadingFileId === file.id}
                    >
                      {downloadingFileId === file.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFileToEdit(file)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFileToMove(file)}>
                      <FolderInput className="h-4 w-4" />
                      Move
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setFileToDelete(file)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {isImage ? (
                  <div className="w-full h-20 mb-2 rounded overflow-hidden bg-muted/50 flex items-center justify-center">
                    <img
                      src={file.blob.getDirectURL()}
                      alt={file.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50 mb-2">
                    <Icon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <p className="text-sm font-medium text-center truncate w-full">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
                {file.tagIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 justify-center">
                    {file.tagIds.slice(0, 2).map((tagId) => {
                      const tag = allTags.find((t) => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <Badge
                          key={tagId}
                          style={{ backgroundColor: tag.color, color: "#fff" }}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {tag.name}
                        </Badge>
                      );
                    })}
                    {file.tagIds.length > 2 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        +{file.tagIds.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // List view
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead
                className="p-3 cursor-pointer select-none hover:bg-muted/50 transition-colors"
                onClick={() => toggleSort("name")}
              >
                <div className="flex items-center gap-1">
                  Name
                  <SortIcon field="name" />
                </div>
              </TableHead>
              <TableHead
                className="p-3 hidden md:table-cell cursor-pointer select-none hover:bg-muted/50 transition-colors"
                onClick={() => toggleSort("size")}
              >
                <div className="flex items-center gap-1">
                  Size
                  <SortIcon field="size" />
                </div>
              </TableHead>
              <TableHead
                className="p-3 hidden lg:table-cell cursor-pointer select-none hover:bg-muted/50 transition-colors"
                onClick={() => toggleSort("date")}
              >
                <div className="flex items-center gap-1">
                  Date
                  <SortIcon field="date" />
                </div>
              </TableHead>
              <TableHead
                className="p-3 hidden lg:table-cell cursor-pointer select-none hover:bg-muted/50 transition-colors"
                onClick={() => toggleSort("type")}
              >
                <div className="flex items-center gap-1">
                  Type
                  <SortIcon field="type" />
                </div>
              </TableHead>
              <TableHead
                className="p-3 hidden xl:table-cell cursor-pointer select-none hover:bg-muted/50 transition-colors"
                onClick={() => toggleSort("tag")}
              >
                <div className="flex items-center gap-1">
                  Tags
                  <SortIcon field="tag" />
                </div>
              </TableHead>
              <TableHead className="p-3 w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Folders */}
            {sortedFolders.map((folder) => (
              <TableRow
                key={`folder-${folder.id}`}
                onDoubleClick={() => onOpenFolder(folder.id)}
                onTouchEnd={handleDoubleTap(() => onOpenFolder(folder.id))}
                className="cursor-pointer"
              >
                <TableCell className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                      <Folder className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">
                        {folder.name}
                      </p>
                      <p className="text-xs text-muted-foreground md:hidden">
                        Folder
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="p-3 text-sm text-muted-foreground hidden md:table-cell">
                  —
                </TableCell>
                <TableCell className="p-3 text-sm text-muted-foreground hidden lg:table-cell">
                  {formatDate(folder.createdDate)}
                </TableCell>
                <TableCell className="p-3 text-sm text-muted-foreground hidden lg:table-cell">
                  Folder
                </TableCell>
                <TableCell className="p-3 hidden xl:table-cell">—</TableCell>
                <TableCell className="p-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onOpenFolder(folder.id)}>
                        <FolderOpen className="h-4 w-4" />
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDownloadFolder(folder)}
                        disabled={downloadingFolder === folder.id}
                      >
                        {downloadingFolder === folder.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        Download as ZIP
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setFolderToRename(folder)}
                      >
                        <Pencil className="h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setFolderToMove(folder)}>
                        <FolderInput className="h-4 w-4" />
                        Move
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setFolderToDelete(folder)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}

            {/* Files */}
            {sortedFiles.map((file) => {
              const Icon = getFileIcon(file.fileType);
              const isSelected = selectedFile?.id === file.id;
              return (
                <TableRow
                  key={`file-${file.id}`}
                  onClick={() => onSelectFile(file)}
                  onDoubleClick={() => setFileToPreview(file)}
                  onTouchEnd={handleDoubleTap(() => setFileToPreview(file))}
                  className={`cursor-pointer ${isSelected ? "bg-primary/10" : ""}`}
                  data-state={isSelected ? "selected" : undefined}
                >
                  <TableCell className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-sm">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground md:hidden">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="p-3 text-sm text-muted-foreground hidden md:table-cell">
                    {formatFileSize(file.size)}
                  </TableCell>
                  <TableCell className="p-3 text-sm text-muted-foreground hidden lg:table-cell">
                    {formatDate(file.uploadDate)}
                  </TableCell>
                  <TableCell className="p-3 text-sm text-muted-foreground hidden lg:table-cell">
                    {file.fileType}
                  </TableCell>
                  <TableCell className="p-3 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {file.tagIds.slice(0, 3).map((tagId) => {
                        const tag = allTags.find((t) => t.id === tagId);
                        if (!tag) return null;
                        return (
                          <Badge
                            key={tagId}
                            style={{
                              backgroundColor: tag.color,
                              color: "#fff",
                            }}
                            className="text-xs"
                          >
                            {tag.name}
                          </Badge>
                        );
                      })}
                      {file.tagIds.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{file.tagIds.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="p-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleDownloadFile(file)}
                          disabled={downloadingFileId === file.id}
                        >
                          {downloadingFileId === file.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFileToEdit(file)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFileToMove(file)}>
                          <FolderInput className="h-4 w-4" />
                          Move
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setFileToDelete(file)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Dialogs - rendered once regardless of view mode */}
      <AlertDialog
        open={!!fileToDelete}
        onOpenChange={() => setFileToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fileToDelete?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFile}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteFile();
              }}
              disabled={isDeletingFile}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingFile && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isDeletingFile ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!folderToDelete}
        onOpenChange={() => setFolderToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{folderToDelete?.name}"? This
              will permanently delete the folder and all its contents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFolder}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteFolder();
              }}
              disabled={isDeletingFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingFolder && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isDeletingFolder ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditFileDialog
        file={fileToEdit}
        open={!!fileToEdit}
        onOpenChange={(open) => !open && setFileToEdit(null)}
      />

      <RenameFolderDialog
        folder={folderToRename}
        open={!!folderToRename}
        onOpenChange={(open) => !open && setFolderToRename(null)}
      />

      <MoveFolderDialog
        folder={folderToMove}
        open={!!folderToMove}
        onOpenChange={(open) => !open && setFolderToMove(null)}
      />

      <MoveFileDialog
        file={fileToMove}
        open={!!fileToMove}
        onOpenChange={(open) => !open && setFileToMove(null)}
      />

      <FilePreviewDialog
        file={fileToPreview}
        open={!!fileToPreview}
        onOpenChange={(open) => !open && setFileToPreview(null)}
      />
    </>
  );
}

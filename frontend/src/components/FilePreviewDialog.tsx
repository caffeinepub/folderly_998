import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileIcon, Calendar, HardDrive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useGetAllTags } from "@/hooks/useQueries";
import { useDownloadFile } from "@/hooks/useDownloadFile";
import { formatFileSize, formatDate } from "@/utils/formatting";
import type { FileMetadata } from "@/backend";

interface FilePreviewDialogProps {
  file: FileMetadata | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilePreviewDialog({
  file,
  open,
  onOpenChange,
}: FilePreviewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { data: allTags = [], isError: isTagsError } = useGetAllTags();
  const { download, downloadingFileId } = useDownloadFile();

  const isDownloading = file ? downloadingFileId === file.id : false;

  const handleDownload = () => {
    if (file) download(file);
  };

  useEffect(() => {
    if (!file || !open) {
      setPreviewUrl(null);
      setTextContent(null);
      return;
    }

    const loadPreview = async () => {
      setIsLoading(true);
      try {
        if (file.fileType.startsWith("image/")) {
          const url = file.blob.getDirectURL();
          setPreviewUrl(url);
        } else if (
          file.fileType.startsWith("text/") ||
          file.fileType === "application/json" ||
          file.fileType === "application/javascript" ||
          file.fileType === "application/xml"
        ) {
          const bytes = await file.blob.getBytes();
          const text = new TextDecoder().decode(bytes);
          setTextContent(text.slice(0, 50000)); // Limit to 50KB of text
        }
      } catch (error) {
        console.error("Preview error:", error);
        toast.error("Failed to load preview");
      } finally {
        setIsLoading(false);
      }
    };

    loadPreview();
  }, [file, open]);

  const fileTags =
    file?.tagIds
      .map((id) => allTags.find((t) => t.id === id))
      .filter((t) => t !== undefined) ?? [];

  const isImage = file?.fileType.startsWith("image/");
  const isText =
    file?.fileType.startsWith("text/") ||
    file?.fileType === "application/json" ||
    file?.fileType === "application/javascript" ||
    file?.fileType === "application/xml";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${isImage ? "sm:max-w-3xl" : "sm:max-w-2xl"} max-h-[90vh] flex flex-col`}
      >
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{file?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* File Info Bar */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" />
              <span>{file ? formatFileSize(file.size) : ""}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>{file ? formatDate(file.uploadDate, true) : ""}</span>
            </div>
            <span className="text-xs bg-muted px-2 py-0.5 rounded">
              {file?.fileType}
            </span>
          </div>

          {/* Tags */}
          {isTagsError ? (
            <span className="text-muted-foreground text-sm">
              Tags unavailable
            </span>
          ) : fileTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {fileTags.map((tag) => (
                <Badge
                  key={tag!.id}
                  style={{ backgroundColor: tag!.color, color: "#fff" }}
                  className="text-xs"
                >
                  {tag!.name}
                </Badge>
              ))}
            </div>
          ) : null}

          {/* Description */}
          {file?.description && (
            <p className="text-sm text-muted-foreground">{file.description}</p>
          )}

          {/* Preview Area */}
          <div className="flex-1 min-h-0 border border-border rounded-lg overflow-hidden bg-muted/30">
            {isLoading ? (
              <div className="p-4">
                <Skeleton className="h-64 w-full" />
              </div>
            ) : previewUrl ? (
              <div className="flex items-center justify-center p-4 h-full">
                <img
                  src={previewUrl}
                  alt={file?.name}
                  className="max-w-full max-h-[50vh] object-contain rounded"
                />
              </div>
            ) : textContent ? (
              <ScrollArea className="h-[50vh]">
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">
                  {textContent}
                </pre>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <FileIcon className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-sm">
                  Preview not available for this file type
                </p>
                <p className="text-xs mt-1">
                  Download the file to view its contents
                </p>
              </div>
            )}
          </div>

          {/* Download Button */}
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full gap-2"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isDownloading ? "Preparing..." : "Download"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

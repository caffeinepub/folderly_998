import { format } from "date-fns";
import { toast } from "sonner";
import type { FileMetadata, Folder, Tag } from "@/backend";
import { formatFileSize, fromNanoseconds } from "./formatting";

/**
 * Download a file by fetching its blob and triggering a browser download.
 */
export async function downloadFile(file: FileMetadata): Promise<void> {
  const toastId = toast.loading(`Preparing ${file.name}...`);
  try {
    const bytes = await file.blob.getBytes();
    const blob = new Blob([bytes], { type: file.fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Download started", { id: toastId });
  } catch (error) {
    toast.error("Failed to download file", { id: toastId });
  }
}

declare global {
  interface Window {
    JSZip: new () => JSZip;
  }
}

interface JSZip {
  file(name: string, data: Uint8Array): void;
  generateAsync(options: { type: "blob" }): Promise<Blob>;
}

export interface DownloadProgress {
  currentFile: string;
  filesProcessed: number;
  totalFiles: number;
}

/**
 * Build a map of folderId -> relative path from the root folder being downloaded
 */
function buildFolderPathMap(
  folders: Folder[],
  rootFolderId: bigint,
): Map<bigint, string> {
  const pathMap = new Map<bigint, string>();
  const folderMap = new Map<bigint, Folder>();

  // Build a lookup map
  for (const folder of folders) {
    folderMap.set(folder.id, folder);
  }

  // Build path for each folder
  function getPath(folderId: bigint): string {
    if (pathMap.has(folderId)) {
      return pathMap.get(folderId)!;
    }

    const folder = folderMap.get(folderId);
    if (!folder) {
      return "";
    }

    // If this is the root folder we're downloading, it's the base
    if (folderId === rootFolderId) {
      pathMap.set(folderId, "");
      return "";
    }

    // Get parent path
    const parentId = folder.parentId;
    if (!parentId) {
      // No parent means it's at root level
      pathMap.set(folderId, folder.name);
      return folder.name;
    }

    const parentPath = getPath(parentId);
    const fullPath = parentPath ? `${parentPath}/${folder.name}` : folder.name;
    pathMap.set(folderId, fullPath);
    return fullPath;
  }

  // Build paths for all folders
  for (const folder of folders) {
    getPath(folder.id);
  }

  return pathMap;
}

export async function downloadFolderAsZip(
  rootFolderId: bigint,
  rootFolderName: string,
  files: FileMetadata[],
  allFolders: Folder[],
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  if (files.length === 0) {
    throw new Error("No files to download");
  }

  const zip = new window.JSZip();

  // Build folder path map for files within the downloaded folder
  const folderPathMap = buildFolderPathMap(allFolders, rootFolderId);

  // Download each file and add to zip with proper path
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    onProgress?.({
      currentFile: file.name,
      filesProcessed: i,
      totalFiles: files.length,
    });

    try {
      const bytes = await file.blob.getBytes();

      // Determine the file path in the ZIP
      let filePath = file.name;
      if (file.folderId) {
        const folderPath = folderPathMap.get(file.folderId);
        if (folderPath) {
          filePath = `${folderPath}/${file.name}`;
        }
      }

      zip.file(filePath, bytes);
    } catch (error) {
      console.error(`Failed to download ${file.name}:`, error);
      // Continue with other files
    }
  }

  onProgress?.({
    currentFile: "Creating ZIP...",
    filesProcessed: files.length,
    totalFiles: files.length,
  });

  // Generate and download the zip
  const content = await zip.generateAsync({ type: "blob" });

  // Trigger download
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${rootFolderName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface ExportOptions {
  files: FileMetadata[];
  folders: Folder[];
  tags: Tag[];
}

function escapeCSVField(field: string): string {
  // If the field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function formatDateForCSV(timestamp: bigint): string {
  return format(fromNanoseconds(timestamp), "yyyy-MM-dd HH:mm:ss");
}

function getFolderPath(folderId: bigint | null, folders: Folder[]): string {
  if (!folderId) return "/";

  const pathParts: string[] = [];
  let currentId: bigint | null = folderId;

  while (currentId) {
    const folder = folders.find((f) => f.id === currentId);
    if (!folder) break;
    pathParts.unshift(folder.name);
    currentId = folder.parentId ?? null;
  }

  return "/" + pathParts.join("/");
}

function getTagNames(tagIds: bigint[], tags: Tag[]): string {
  return tagIds
    .map((id) => tags.find((t) => t.id === id)?.name)
    .filter((name) => name !== undefined)
    .join("; ");
}

export function exportMetadataAsCSV({
  files,
  folders,
  tags,
}: ExportOptions): void {
  if (files.length === 0) {
    throw new Error("No files to export");
  }

  try {
    // CSV headers
    const headers = [
      "Name",
      "Description",
      "Tags",
      "Folder Path",
      "File Type",
      "Size",
      "Size (bytes)",
      "Upload Date",
      "File ID",
    ];

    // Build CSV rows
    const rows = files.map((file) => [
      escapeCSVField(file.name ?? ""),
      escapeCSVField(file.description ?? ""),
      escapeCSVField(getTagNames(file.tagIds ?? [], tags)),
      escapeCSVField(getFolderPath(file.folderId ?? null, folders)),
      escapeCSVField(file.fileType ?? ""),
      escapeCSVField(formatFileSize(file.size ?? BigInt(0))),
      (file.size ?? BigInt(0)).toString(),
      escapeCSVField(formatDateForCSV(file.uploadDate ?? BigInt(0))),
      escapeCSVField(String(file.id)),
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `folderly-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(
      `Failed to export CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

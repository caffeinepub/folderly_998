import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useUploadFile } from "@/hooks/useQueries";
import { ExternalBlob } from "@/backend";
import type { FolderId } from "@/backend";

export function useFileUpload(
  currentFolderId: FolderId | null,
  onUploadComplete?: () => void,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { mutateAsync: uploadFile } = useUploadFile();

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (isUploading) return;

      setIsUploading(true);
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        const toastId = toast.loading(`Uploading ${file.name}...`);

        try {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          const blob = ExternalBlob.fromBytes(uint8Array).withUploadProgress(
            (percentage) => {
              toast.loading(
                `Uploading ${file.name}... ${Math.round(percentage)}%`,
                {
                  id: toastId,
                },
              );
            },
          );

          await uploadFile({
            name: file.name,
            description: "",
            tagIds: [],
            folderId: currentFolderId,
            size: BigInt(file.size),
            fileType: file.type || "application/octet-stream",
            blob,
          });

          toast.success(`${file.name} uploaded`, { id: toastId });
        } catch (error) {
          console.error("Upload error:", error);
          toast.error(`Failed to upload ${file.name}`, { id: toastId });
        }
      }

      setIsUploading(false);
      onUploadComplete?.();

      // Reset the input so the same file can be selected again
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [uploadFile, currentFolderId, onUploadComplete, isUploading],
  );

  const triggerUpload = useCallback(() => {
    if (isUploading) return;
    inputRef.current?.click();
  }, [isUploading]);

  const FileInput = useCallback(
    () => (
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
    ),
    [handleFiles],
  );

  return { triggerUpload, isUploading, FileInput };
}

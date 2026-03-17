import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";
import type {
  FileMetadata,
  Folder,
  FolderContents,
  FileId,
  FolderId,
  Tag,
  TagId,
} from "@/backend";
import { ExternalBlob } from "@/backend";

export function useProfile() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery({
    queryKey: ["profile", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.getProfile();
      return result ?? null;
    },
    enabled: !!actor && !isFetching && !!identity,
  });
}

export function useSetProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (!actor) throw new Error("Actor not ready");
      await actor.setProfile(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["profile", identity?.getPrincipal().toString()],
      });
    },
  });
}

export function useGetAllFolders() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<Folder[]>({
    queryKey: ["folders", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllFolders();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetFolderContents(folderId: FolderId | null) {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<FolderContents>({
    queryKey: [
      "folderContents",
      folderId?.toString() ?? null,
      identity?.getPrincipal().toString(),
    ],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.getFolderContents(folderId);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetFolderPath(folderId: FolderId | null) {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<Folder[]>({
    queryKey: [
      "folderPath",
      folderId?.toString() ?? null,
      identity?.getPrincipal().toString(),
    ],
    queryFn: async () => {
      if (!actor || !folderId) return [];
      return actor.getFolderPath(folderId);
    },
    enabled: !!actor && !isFetching && !!folderId,
  });
}

export function useCreateFolder() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async ({
      name,
      parentId,
    }: {
      name: string;
      parentId: FolderId | null;
    }) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.createFolder(name, parentId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["folders", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "folderContents",
          variables.parentId?.toString() ?? null,
          identity?.getPrincipal().toString(),
        ],
      });
    },
  });
}

export function useRenameFolder() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async ({ id, newName }: { id: FolderId; newName: string }) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.renameFolder(id, newName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["folders", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["folderContents"],
      });
    },
  });
}

export function useMoveFolder() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async ({
      id,
      newParentId,
    }: {
      id: FolderId;
      newParentId: FolderId | null;
    }) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.moveFolder(id, newParentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["folders", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["folderContents"],
      });
    },
  });
}

export function useDeleteFolder() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async (id: FolderId) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.deleteFolder(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["folders", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["folderContents"],
      });
    },
  });
}

export function useGetAllFiles() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<FileMetadata[]>({
    queryKey: ["files", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllFiles();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUploadFile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async ({
      name,
      description,
      tagIds,
      folderId,
      size,
      fileType,
      blob,
    }: {
      name: string;
      description: string;
      tagIds: TagId[];
      folderId: FolderId | null;
      size: bigint;
      fileType: string;
      blob: ExternalBlob;
    }) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.uploadFile(
        name,
        description,
        tagIds,
        folderId,
        size,
        fileType,
        blob,
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["files", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "folderContents",
          variables.folderId?.toString() ?? null,
          identity?.getPrincipal().toString(),
        ],
      });
      queryClient.invalidateQueries({ queryKey: ["filesInFolder"] });
      queryClient.invalidateQueries({
        queryKey: ["tags", identity?.getPrincipal().toString()],
      });
    },
  });
}

export function useUpdateFile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      description,
      tagIds,
    }: {
      id: FileId;
      name: string;
      description: string;
      tagIds: TagId[];
    }) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.updateFile(id, name, description, tagIds);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["files", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "file",
          variables.id.toString(),
          identity?.getPrincipal().toString(),
        ],
      });
      queryClient.invalidateQueries({ queryKey: ["folderContents"] });
      queryClient.invalidateQueries({
        queryKey: ["tags", identity?.getPrincipal().toString()],
      });
    },
  });
}

export function useMoveFile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async ({
      id,
      newFolderId,
    }: {
      id: FileId;
      newFolderId: FolderId | null;
    }) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.moveFile(id, newFolderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["files", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["folderContents"] });
      queryClient.invalidateQueries({ queryKey: ["filesInFolder"] });
    },
  });
}

export function useDeleteFile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async (id: FileId) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.deleteFile(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["files", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["folderContents"] });
      queryClient.invalidateQueries({ queryKey: ["filesInFolder"] });
      queryClient.invalidateQueries({
        queryKey: ["tags", identity?.getPrincipal().toString()],
      });
    },
  });
}

export function useSearchFilesWithTags(searchTerm: string, tagIds: TagId[]) {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  const trimmedTerm = searchTerm.trim();
  const isFiltering = trimmedTerm !== "" || tagIds.length > 0;

  return useQuery<FileMetadata[]>({
    queryKey: [
      "searchFilesWithTags",
      trimmedTerm,
      tagIds.map((id) => id.toString()),
      identity?.getPrincipal().toString(),
    ],
    queryFn: async () => {
      if (!actor) return [];
      return actor.searchFilesWithTags(trimmedTerm, tagIds);
    },
    enabled: !!actor && !isFetching && isFiltering,
  });
}

export function useGetAllTags() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<Tag[]>({
    queryKey: ["tags", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllTags();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateTag() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.createTag(name, color);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tags", identity?.getPrincipal().toString()],
      });
    },
  });
}

export function useUpdateTag() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      color,
    }: {
      id: TagId;
      name: string;
      color: string;
    }) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.updateTag(id, name, color);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tags", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["files", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["folderContents"] });
    },
  });
}

export function useDeleteTag() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async (id: TagId) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.deleteTag(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tags", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["files", identity?.getPrincipal().toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["folderContents"] });
    },
  });
}

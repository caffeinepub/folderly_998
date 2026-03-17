import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export type TagId = bigint;
export interface Tag {
    id: TagId;
    name: string;
    color: string;
}
export interface FileMetadata {
    id: FileId;
    blob: ExternalBlob;
    name: string;
    size: bigint;
    description: string;
    fileType: string;
    modifiedDate: bigint;
    tagIds: Array<TagId>;
    folderId?: FolderId;
    uploadDate: bigint;
}
export interface FolderContents {
    files: Array<FileMetadata>;
    folders: Array<Folder>;
}
export interface Folder {
    id: FolderId;
    name: string;
    createdDate: bigint;
    modifiedDate: bigint;
    parentId?: FolderId;
}
export type FileId = bigint;
export interface Profile {
    name: string;
}
export type FolderId = bigint;
export interface backendInterface {
    createFolder(name: string, parentId: FolderId | null): Promise<Folder>;
    createTag(name: string, color: string): Promise<Tag>;
    deleteFile(id: FileId): Promise<void>;
    deleteFolder(id: FolderId): Promise<void>;
    deleteTag(id: TagId): Promise<void>;
    getAllFiles(): Promise<Array<FileMetadata>>;
    getAllFilesInFolder(folderId: FolderId | null): Promise<Array<FileMetadata>>;
    getAllFolders(): Promise<Array<Folder>>;
    getAllTags(): Promise<Array<Tag>>;
    getFolderContents(folderId: FolderId | null): Promise<FolderContents>;
    getFolderPath(folderId: FolderId): Promise<Array<Folder>>;
    getProfile(): Promise<Profile | null>;
    getTag(id: TagId): Promise<Tag>;
    moveFile(id: FileId, newFolderId: FolderId | null): Promise<FileMetadata>;
    moveFolder(id: FolderId, newParentId: FolderId | null): Promise<Folder>;
    renameFolder(id: FolderId, newName: string): Promise<Folder>;
    searchFilesWithTags(searchTerm: string, filterTagIds: Array<TagId>): Promise<Array<FileMetadata>>;
    setProfile(name: string): Promise<void>;
    updateFile(id: FileId, name: string, description: string, tagIds: Array<TagId>): Promise<FileMetadata>;
    updateTag(id: TagId, name: string, color: string): Promise<Tag>;
    uploadFile(name: string, description: string, tagIds: Array<TagId>, folderId: FolderId | null, size: bigint, fileType: string, blob: ExternalBlob): Promise<FileMetadata>;
}

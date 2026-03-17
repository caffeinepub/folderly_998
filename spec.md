# Folderly

## Overview

A file management application for the Internet Computer that enables users to store, organize, and browse digital files. Users can upload files, organize them into nested folders, apply colored tags for categorization, search across their content, preview supported file types, and export data. All files are stored in Caffeine's external blob storage with metadata stored on-chain, providing full user ownership through Internet Identity authentication.

## Authentication

- Internet Identity required for all operations
- Anonymous access is not permitted
- User data is isolated by principal - users can only access their own files, folders, and tags
- Display name required on first login via profile setup dialog

## Core Features

### File Management

- Upload files of any type with automatic blob storage
- File properties:
  - Name (required, non-empty)
  - Description (optional)
  - Tags (optional, multiple)
  - Folder location (optional, null = root)
  - File type (MIME type)
  - Size (in bytes)
  - Upload date and modified date (timestamps)
- Edit file metadata (name, description, tags)
- Move files between folders
- Download individual files
- Automatic name collision handling with "(N)" suffix pattern

### Folder Organization

- Create nested folder hierarchy
- Folder properties:
  - Name (required, non-empty)
  - Parent folder (optional, null = root level)
  - Created and modified dates
- Rename folders
- Move folders (with cycle detection to prevent moving into descendants)
- Delete folders with cascading deletion of all contents
- Maximum nesting depth of 100 levels
- Automatic name collision handling within same parent

### Tagging System

- Create tags with custom colors
- Tag properties:
  - Name (required, non-empty)
  - Color (hex color string)
- Assign multiple tags to files
- Edit tag names and colors
- Delete tags (automatically removes from all files)
- Filter files by tags (OR logic - files with any selected tag)

### Search & Filtering

- Global search across file names, descriptions, and tag names
- Case-insensitive matching
- Combine search with tag filters
- Search results span all folders

### File Preview

- Image preview (displays directly in dialog)
- Text file preview (JSON, JS, XML, plain text) up to 50KB
- Metadata display: size, type, upload date, tags, description

### Export & Download

- Download individual files
- Download folders as ZIP with preserved structure
- Export file metadata as CSV (name, description, tags, folder path, type, size, dates)

### Statistics

- Total file count
- Total folder count
- Total storage size

## Backend Data Storage

- **Files**: Per-user map storing FileMetadata with blob reference, indexed by FileId (Nat)
- **Folders**: Per-user map storing Folder records, indexed by FolderId (Nat)
- **Tags**: Per-user map storing Tag records, indexed by TagId (Nat)
- **Profiles**: Map of principal to display name
- **ID Counters**: Per-user auto-incrementing counters for files, folders, and tags
- All state persists across canister upgrades via orthogonal persistence

## Backend Operations

- All operations require authentication (traps for anonymous callers)
- Owner verification implicit via per-user data isolation
- Input validation:
  - Empty name checks for files, folders, tags, and profiles
  - Folder existence checks before file/folder placement
  - Tag existence checks before assignment to files
  - Circular reference prevention for folder moves
  - Depth limit enforcement (100 levels)
- Error handling via Debug.trap with descriptive messages
- Blob storage managed by Caffeine infrastructure with automatic GC for orphaned blobs

## User Interface

- Landing page for unauthenticated users with feature highlights
- Profile setup dialog on first login
- Header with logo, search bar, and user menu (Edit Name, Manage Tags, Logout)
- Breadcrumb navigation showing current folder path
- File list with dual view modes (list table / grid cards)
- Sorting by name, date, type, or size (ascending/descending)
- "New" dropdown for file upload and folder creation
- Drag-and-drop file upload zone with progress tracking
- Right-click context menus for file/folder actions
- Dialogs: file preview, edit file, create folder, rename folder, move file, move folder, tag management
- Confirmation alerts for delete actions with loading states
- Toast notifications for operation feedback

## Design System

- shadcn/ui component library with Tailwind CSS
- Lucide icons throughout
- Light/dark mode support via CSS variables
- Responsive design:
  - Mobile: single column grid, simplified table columns
  - Tablet: 3-column grid
  - Desktop: 5+ column grid, full table view
- Tag colors displayed as colored badges
- Loading skeletons during data fetches
- Empty state illustrations for empty folders

## Error Handling

- "Not authenticated" - anonymous caller attempts operation
- "Folder not found" - invalid folder ID referenced
- "File not found" - invalid file ID referenced
- "Tag not found" - invalid tag ID referenced
- "[Type] name cannot be empty" - empty name validation
- "Cannot move folder into itself" - self-parent assignment
- "Cannot move folder into its own descendant" - circular reference
- "Folder hierarchy too deep or circular reference detected" - depth limit exceeded
- Network errors during upload show retry with exponential backoff
- All mutations show inline errors or toast notifications on failure

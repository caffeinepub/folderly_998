import { useState } from "react";
import {
  Loader2,
  FolderTree,
  Search,
  Eye,
  Plus,
  FolderPlus,
  Upload,
  Filter,
  X,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast, Toaster } from "sonner";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useActor } from "./hooks/useActor";
import {
  useProfile,
  useGetFolderContents,
  useGetFolderPath,
  useSearchFilesWithTags,
  useGetAllTags,
  useGetAllFiles,
  useGetAllFolders,
} from "./hooks/useQueries";
import { useDebounce } from "./hooks/useDebounce";
import { exportMetadataAsCSV } from "./utils/exports";
import { FilePreviewCard } from "./components/FilePreviewCard";
import { Header } from "./components/Header";
import { ProfileSetupDialog } from "./components/ProfileSetupDialog";
import { FileList } from "./components/FileList";
import { useFileUpload } from "./hooks/useFileUpload";
import { CreateFolderDialog } from "./components/CreateFolderDialog";
import { Breadcrumb } from "./components/Breadcrumb";
import type { FileMetadata, TagId } from "./backend";

export default function App() {
  const { identity, isInitializing, login, isLoggingIn } =
    useInternetIdentity();
  const { isFetching, actor } = useActor();

  const isAuthenticated = !!identity;

  // Loading state
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Landing page (not authenticated)
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="container mx-auto px-4 lg:px-0 py-8 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <FolderTree className="w-5 h-5 text-primary" />
            <span className="text-lg font-semibold tracking-tight text-foreground font-sans">
              Folderly
            </span>
          </div>
        </header>

        {/* Main Content */}
        <div className="container mx-auto px-4 lg:px-0 flex-1 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-16 lg:gap-24 py-12 lg:py-0">
          {/* Left Section */}
          <div className="flex-1 max-w-xl">
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-light text-foreground mb-8 leading-[1.15] tracking-tight font-sans">
              Organize your
              <br />
              <span className="font-semibold text-primary">
                files, your way.
              </span>
            </h1>

            <p className="text-base text-muted-foreground mb-12 leading-relaxed max-w-md font-sans">
              A simple, private workspace for your documents, images, and files.
              Create folders, add tags, and find anything instantly.
            </p>

            {/* Key Features */}
            <div className="flex flex-wrap gap-x-6 gap-y-4 mb-12 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <FolderTree className="w-4 h-4 text-primary" />
                </div>
                <span className="text-foreground font-sans">
                  Folders & Tags
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <Search className="w-4 h-4 text-primary" />
                </div>
                <span className="text-foreground font-sans">Quick Search</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <Eye className="w-4 h-4 text-primary" />
                </div>
                <span className="text-foreground font-sans">File Previews</span>
              </div>
            </div>

            {/* CTA Button */}
            <Button
              size="lg"
              onClick={login}
              disabled={isLoggingIn}
              className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto font-medium py-6 px-8 text-sm tracking-wide rounded-full transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                "Get Started with Internet Identity"
              )}
            </Button>
          </div>

          {/* Right Section - Preview Cards */}
          <div className="w-full lg:flex-1 lg:max-w-md">
            <div className="space-y-3">
              <FilePreviewCard
                type="folder"
                name="Work Projects"
                meta="12 files"
                tags={["work"]}
              />
              <FilePreviewCard
                type="image"
                name="vacation-photo.jpg"
                meta="4.2 MB"
                tags={["personal", "photos"]}
              />
              <FilePreviewCard
                type="document"
                name="Q4-Report.pdf"
                meta="2.4 MB"
                tags={["finance"]}
              />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Loading actor
  if (!actor || isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Main app (authenticated)
  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const {
    data: profile,
    isLoading: isLoadingProfile,
    isError: isProfileError,
    error: profileError,
  } = useProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<TagId[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<bigint | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);

  const { triggerUpload, FileInput } = useFileUpload(currentFolderId);

  // Debounce search query (300ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const {
    data: folderContents,
    isLoading: isLoadingContents,
    isError: isContentsError,
    error: contentsError,
  } = useGetFolderContents(currentFolderId);
  const { data: folderPath = [] } = useGetFolderPath(currentFolderId);
  const {
    data: allTags = [],
    isError: isTagsError,
    error: tagsError,
  } = useGetAllTags();
  const {
    data: allFiles = [],
    isError: isFilesError,
    error: filesError,
  } = useGetAllFiles();
  const {
    data: allFolders = [],
    isError: isFoldersError,
    error: foldersError,
  } = useGetAllFolders();

  // Debug logging for errors
  if (isProfileError) console.error("Profile error:", profileError);
  if (isContentsError) console.error("Contents error:", contentsError);
  if (isTagsError) console.error("Tags error:", tagsError);
  if (isFilesError) console.error("Files error:", filesError);
  if (isFoldersError) console.error("Folders error:", foldersError);

  const isFiltering =
    debouncedSearchQuery.trim() !== "" || selectedTagIds.length > 0;
  const {
    data: filteredResults,
    isLoading: isSearching,
    isError: isSearchError,
  } = useSearchFilesWithTags(debouncedSearchQuery, selectedTagIds);

  const hasProfile = profile && profile.name;

  // Use filtered results when filtering, otherwise show folder contents
  const displayedFiles = isFiltering
    ? (filteredResults ?? [])
    : (folderContents?.files ?? []);
  const displayedFolders = isFiltering ? [] : (folderContents?.folders ?? []);

  const toggleTagFilter = (tagId: TagId) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTagIds([]);
  };

  const handleOpenFolder = (folderId: bigint) => {
    setCurrentFolderId(folderId);
    setSelectedFile(null);
  };

  const handleNavigate = (folderId: bigint | null) => {
    setCurrentFolderId(folderId);
    setSelectedFile(null);
  };

  const handleExportCSV = () => {
    try {
      exportMetadataAsCSV({
        files: allFiles,
        folders: allFolders,
        tags: allTags,
      });
      toast.success("Metadata exported as CSV");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export CSV",
      );
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasDataError =
    isProfileError ||
    isContentsError ||
    isTagsError ||
    isFilesError ||
    isFoldersError;

  if (hasDataError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-destructive text-center">
          <p>Failed to load data. Please refresh.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ProfileSetupDialog open={!hasProfile} />
      {hasProfile && (
        <div className="min-h-screen bg-background flex flex-col">
          <Header userName={profile.name} />
          <main className="flex-1 p-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Tag Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    <span className="hidden sm:inline">Tags</span>
                    {selectedTagIds.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                        {selectedTagIds.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>Filter by Tag</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {allTags.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      No tags yet
                    </div>
                  ) : (
                    allTags.map((tag) => (
                      <DropdownMenuCheckboxItem
                        key={tag.id}
                        checked={selectedTagIds.includes(tag.id)}
                        onCheckedChange={() => toggleTagFilter(tag.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                        </div>
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                onClick={handleExportCSV}
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">New</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowCreateFolder(true)}>
                    <FolderPlus className="h-4 w-4" />
                    New Folder
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={triggerUpload}>
                    <Upload className="h-4 w-4" />
                    Upload File
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Active filters indicator */}
            {isFiltering && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  Filtering:
                </span>
                {searchQuery && (
                  <Badge variant="secondary" className="gap-1">
                    Search: "{searchQuery}"
                    <button
                      onClick={() => setSearchQuery("")}
                      className="ml-1 hover:bg-muted rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {selectedTagIds.map((tagId) => {
                  const tag = allTags.find((t) => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <Badge
                      key={tagId}
                      style={{ backgroundColor: tag.color, color: "#fff" }}
                      className="gap-1"
                    >
                      {tag.name}
                      <button
                        onClick={() => toggleTagFilter(tagId)}
                        className="ml-1 hover:bg-black/20 rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-6 px-2 text-xs"
                >
                  Clear all
                </Button>
              </div>
            )}

            {/* Breadcrumb - always visible */}
            <div className="mb-4">
              <Breadcrumb path={folderPath} onNavigate={handleNavigate} />
            </div>

            {/* Hidden file input for uploads */}
            <FileInput />

            {/* File List */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {isSearchError ? (
                <div className="text-destructive p-4 text-center">
                  Failed to search files. Please try again.
                </div>
              ) : (
                <FileList
                  folders={displayedFolders}
                  files={displayedFiles}
                  isLoading={isLoadingContents || isSearching}
                  selectedFile={selectedFile}
                  onSelectFile={setSelectedFile}
                  onOpenFolder={handleOpenFolder}
                />
              )}
            </div>
          </main>
        </div>
      )}

      {/* Create Folder Dialog */}
      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        parentFolderId={currentFolderId}
      />
      <Toaster position="bottom-right" />
    </>
  );
}

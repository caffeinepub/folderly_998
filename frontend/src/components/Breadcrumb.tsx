import { Home } from "lucide-react";
import {
  Breadcrumb as ShadcnBreadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { Folder } from "@/backend";

interface BreadcrumbProps {
  path: Folder[];
  onNavigate: (folderId: bigint | null) => void;
}

export function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  // Path comes from backend as child-to-root, we need root-to-child
  const reversedPath = [...path].reverse();

  return (
    <ShadcnBreadcrumb>
      <BreadcrumbList className="flex-nowrap overflow-x-auto">
        <BreadcrumbItem>
          <BreadcrumbLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate(null);
            }}
            className="flex items-center gap-1"
          >
            <Home className="h-4 w-4" />
          </BreadcrumbLink>
        </BreadcrumbItem>

        {reversedPath.map((folder, index) => {
          const isLast = index === reversedPath.length - 1;
          return (
            <BreadcrumbItem key={folder.id} className="shrink-0">
              <BreadcrumbSeparator />
              {isLast ? (
                <BreadcrumbPage>{folder.name}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(folder.id);
                  }}
                >
                  {folder.name}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </ShadcnBreadcrumb>
  );
}

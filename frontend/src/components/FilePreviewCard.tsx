import { Folder, Image, FileText, Tag } from "lucide-react";

export function FilePreviewCard({
  type,
  name,
  meta,
  tags,
}: {
  type: "folder" | "image" | "document";
  name: string;
  meta: string;
  tags: string[];
}) {
  const icons = {
    folder: Folder,
    image: Image,
    document: FileText,
  };
  const Icon = icons[type];

  const iconColors = {
    folder:
      "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30",
    image:
      "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30",
    document: "text-primary bg-secondary",
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColors[type]}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate font-sans">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground font-sans">{meta}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

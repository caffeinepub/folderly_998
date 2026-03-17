import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSetProfile } from "../hooks/useQueries";

interface ProfileSetupDialogProps {
  open: boolean;
}

export function ProfileSetupDialog({ open }: ProfileSetupDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { mutate: setProfile, isPending } = useSetProfile();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setProfile(
      { name: name.trim() },
      {
        onError: (err: unknown) => {
          setError(
            err instanceof Error ? err.message : "Failed to save profile",
          );
        },
      },
    );
  };

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Welcome to Folderly!</DialogTitle>
            <DialogDescription>
              Let's set up your profile. Enter your name to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setName(e.target.value)
                }
                maxLength={100}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={!name.trim() || isPending}
              className="rounded-full"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "Saving..." : "Get Started"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

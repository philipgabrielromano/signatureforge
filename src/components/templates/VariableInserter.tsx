"use client";

import { VARIABLE_CATALOG } from "@/lib/variables";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Braces } from "lucide-react";

export function VariableInserter({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Braces className="mr-2 h-4 w-4" />
          Insert variable
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        {VARIABLE_CATALOG.map((item) => (
          <DropdownMenuItem key={item.token} onSelect={() => onInsert(item.token)}>
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">
                {item.token} · {item.description}
              </p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = "Enter project location",
  className,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allLocations, setAllLocations] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase
        .from("projects")
        .select("location")
        .not("location", "is", null)
        .order("location");

      if (data) {
        const unique = [...new Set(data.map((p) => p.location).filter(Boolean))] as string[];
        setAllLocations(unique);
      }
    };
    fetchLocations();
  }, []);

  useEffect(() => {
    if (!value || value.length < 1) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    const filtered = allLocations.filter((loc) =>
      loc.toLowerCase().includes(value.toLowerCase())
    );
    setSuggestions(filtered);
    setIsOpen(filtered.length > 0);
    setHighlightedIndex(-1);
  }, [value, allLocations]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = (loc: string) => {
    onChange(loc);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
          {suggestions.map((loc, idx) => (
            <button
              key={loc}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                idx === highlightedIndex && "bg-accent"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(loc);
              }}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{loc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

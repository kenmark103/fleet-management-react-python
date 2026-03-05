/**
 * components/molecules/DataTable.tsx
 * Generic data table used across all list pages.
 * §4.2 Molecules — props: columns, data, loading, onRowClick, searchable, pagination
 *
 * Intentionally framework-agnostic (no TanStack Table dependency) —
 * swap in TanStack Table later if needed without changing the API.
 */

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { LoadingSpinner } from "../atoms/LoadingSpinner";
import { EmptyState } from "../atoms/EmptyState";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { DEFAULT_PAGE_SIZE } from "../../lib/constants";
import { Database } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Column<TRow> {
  /** Unique key — also used as a fallback header if `header` not provided */
  key: string;
  header: string;
  /** Render function — receives the full row */
  cell: (row: TRow) => React.ReactNode;
  /** Optional: make this column sortable (future enhancement hook) */
  sortable?: boolean;
  className?: string;
}

interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<TRow> {
  columns: Column<TRow>[];
  data: TRow[];
  loading?: boolean;
  /** Row click handler — e.g. navigate to detail page */
  onRowClick?: (row: TRow) => void;
  /** Shows a search input above the table. Filter logic is the caller's responsibility. */
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  /** If omitted, client-side pagination is applied */
  pagination?: PaginationState;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function DataTable<TRow extends { id: string }>({
  columns,
  data,
  loading = false,
  onRowClick,
  searchable = false,
  searchPlaceholder = "Search…",
  onSearchChange,
  pagination,
  emptyTitle = "No results",
  emptyDescription = "Nothing to show here yet.",
  className,
}: DataTableProps<TRow>) {
  const [searchValue, setSearchValue] = useState("");

  // ── Client-side pagination (when caller doesn't handle it server-side)
  const [clientPage, setClientPage] = useState(1);
  const pageSize = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
  const isServerPaginated = !!pagination;

  const displayData = isServerPaginated
    ? data
    : data.slice((clientPage - 1) * pageSize, clientPage * pageSize);

  const totalItems = isServerPaginated ? pagination.totalItems : data.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPage = isServerPaginated ? pagination.page : clientPage;

  function handleSearch(value: string) {
    setSearchValue(value);
    setClientPage(1);
    onSearchChange?.(value);
  }

  function handlePageChange(page: number) {
    if (isServerPaginated) {
      pagination.onPageChange(page);
    } else {
      setClientPage(page);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search bar */}
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-16 text-center">
                  <LoadingSpinner size="md" className="mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : displayData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <EmptyState
                    icon={Database}
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                </TableCell>
              </TableRow>
            ) : (
              displayData.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              Previous
            </Button>
            <span className="px-2">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
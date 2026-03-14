/**
 * components/forms/ExpenseForm.tsx
 * Fleet Management System — Phase 6
 *
 * Shared form used by:
 *   /fuel/expenses/new
 *   /fuel/expenses/$expenseId/edit
 */

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import apiClient from "../../lib/api";
import type { Expense, ExpenseCreate, ExpenseUpdate, ExpenseCategory } from "../../types/fuel";

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "fuel",        label: "Fuel" },
  { value: "maintenance", label: "Maintenance" },
  { value: "tolls",       label: "Tolls" },
  { value: "tyres",       label: "Tyres" },
  { value: "insurance",   label: "Insurance" },
  { value: "licensing",   label: "Licensing" },
  { value: "salary",      label: "Salary" },
  { value: "other",       label: "Other" },
];

interface ExpenseFormProps {
  initial?:    Expense;
  onSubmit:    (data: ExpenseCreate | ExpenseUpdate) => Promise<void>;
  isLoading:   boolean;
}

export function ExpenseForm({ initial, onSubmit, isLoading }: ExpenseFormProps) {
  const navigate   = useNavigate();
  const isEditMode = Boolean(initial);

  const [category,    setCategory]    = useState<ExpenseCategory>(initial?.category ?? "other");
  const [amount,      setAmount]      = useState(initial?.amount      ?? 0);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [truckId,     setTruckId]     = useState(initial?.truckId     ?? "");
  const [driverId,    setDriverId]    = useState(initial?.driverId    ?? "");
  const [tripId,      setTripId]      = useState(initial?.tripId      ?? "");
  const [expenseDate, setExpenseDate] = useState(
    initial?.expenseDate
      ? initial.expenseDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );

  // ── Selectors ─────────────────────────────────────────────────────────────
  const { data: trucksData } = useQuery({
    queryKey: ["trucks-select"],
    queryFn:  () => apiClient.get<{ data: { id: string; plateNumber: string }[] }>("/api/v1/fleet/trucks?page_size=200").then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: driversData } = useQuery({
    queryKey: ["drivers-select"],
    queryFn:  () => apiClient.get<{ data: { id: string; firstName: string; lastName: string }[] }>("/api/v1/drivers?limit=200").then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: tripsData } = useQuery({
    queryKey: ["trips-select-all"],
    queryFn:  () => apiClient.get<{ data: { id: string; tripNumber: string; origin: string; destination: string }[] }>("/api/v1/trips?page_size=100").then(r => r.data.data),
    staleTime: 2 * 60 * 1000,
  });

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      category,
      amount,
      description,
      truckId:     truckId  || undefined,
      driverId:    driverId || undefined,
      tripId:      tripId   || undefined,
      expenseDate: new Date(expenseDate).toISOString(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Category */}
        <div className="space-y-1.5">
          <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as ExpenseCategory)}
            required
          >
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount <span className="text-destructive">*</span></Label>
          <Input
            id="amount"
            type="number"
            min={0.01}
            step={0.01}
            value={amount || ""}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            placeholder="e.g. 250.00"
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="description">
            Description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the expense…"
            rows={3}
            required
          />
        </div>

        {/* Expense date */}
        <div className="space-y-1.5">
          <Label htmlFor="expenseDate">Date <span className="text-destructive">*</span></Label>
          <Input
            id="expenseDate"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
          />
        </div>

        {/* Truck (optional) */}
        <div className="space-y-1.5">
          <Label htmlFor="truck">
            Truck <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Select
            value={truckId || "none"}
            onValueChange={(v) => setTruckId(v === "none" ? "" : v)}
          >
            <SelectTrigger id="truck">
              <SelectValue placeholder="No truck linked" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No truck linked</SelectItem>
              {trucksData?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.plateNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Driver (optional) */}
        <div className="space-y-1.5">
          <Label htmlFor="driver">
            Driver <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Select
            value={driverId || "none"}
            onValueChange={(v) => setDriverId(v === "none" ? "" : v)}
          >
            <SelectTrigger id="driver">
              <SelectValue placeholder="No driver linked" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No driver linked</SelectItem>
              {driversData?.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.firstName} {d.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Trip (optional) */}
        <div className="space-y-1.5">
          <Label htmlFor="trip">
            Trip <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Select
            value={tripId || "none"}
            onValueChange={(v) => setTripId(v === "none" ? "" : v)}
          >
            <SelectTrigger id="trip">
              <SelectValue placeholder="No trip linked" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No trip linked</SelectItem>
              {tripsData?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.tripNumber} — {t.origin} → {t.destination}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: "/fuel" })}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !category || amount <= 0 || !description.trim()}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditMode ? "Save Changes" : "Add Expense"}
        </Button>
      </div>
    </form>
  );
}
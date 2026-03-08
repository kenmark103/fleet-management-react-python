// ═════════════════════════════════════════════════════════════════════════════
// routes/_auth/fuel/expenses/new.tsx
// /fuel/expenses/new — Create a new expense
// ═════════════════════════════════════════════════════════════════════════════

/**
 * routes/_auth/fuel/expenses/new.tsx
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Receipt } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { ExpenseForm } from "../../../../components/forms/ExpenseForm";
import { useCreateExpense } from "../../../../hooks/useFuel";
import { toast } from "sonner";

import type { ExpenseCreate, ExpenseUpdate } from "../../../../types/fuel";

export const Route = createFileRoute("/_auth/fuel/expenses/new")({
  component: NewExpensePage,
});

function NewExpensePage() {
  const navigate       = useNavigate();
  const createExpense  = useCreateExpense();

  // Type the parameter as the wide union the form declares, then cast to
  //    ExpenseCreate for mutateAsync — new page is always create-only.
  const handleSubmit = async (data: ExpenseCreate | ExpenseUpdate) => {
    try {
      await createExpense.mutateAsync(data as ExpenseCreate);
      toast.success("Expense added.");
      navigate({ to: "/fuel" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add expense.");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Add Expense"
        subtitle="Record a new operating expense"
        icon={<Receipt className="h-6 w-6" />}
        actions={
          <Link to="/fuel">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        }
      />
      <div className="bg-card border rounded-lg p-6">
        <ExpenseForm
          onSubmit={handleSubmit}
          isLoading={createExpense.isPending}
        />
      </div>
    </div>
  );
}
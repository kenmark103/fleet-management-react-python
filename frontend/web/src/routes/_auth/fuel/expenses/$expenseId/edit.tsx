
// ═════════════════════════════════════════════════════════════════════════════
// routes/_auth/fuel/expenses/$expenseId/edit.tsx
// /fuel/expenses/$expenseId/edit — Edit an existing expense
//
// NOTE: Split into its own file at
//       src/routes/_auth/fuel/expenses/$expenseId/edit.tsx
// ═════════════════════════════════════════════════════════════════════════════

/**
 * routes/_auth/fuel/expenses/$expenseId/edit.tsx
 */
import {
  createFileRoute as createEditRoute,
  useNavigate as useEditNav,
} from "@tanstack/react-router";
import { ArrowLeft, Receipt as ReceiptIcon, Loader2 } from "lucide-react";
import { Link as EditLink } from "@tanstack/react-router";
import { Button as EditButton } from "../../../../../components/ui/button";
import { PageHeader as EditPageHeader } from "../../../../../components/molecules/PageHeader";
import { ExpenseForm as EditExpenseForm } from "../../../../../components/forms/ExpenseForm";
import { useExpense, useUpdateExpense } from "../../../../../hooks/useFuel";
import { toast as editToast } from "sonner";

export const Route = createEditRoute("/_auth/fuel/expenses/$expenseId/edit")({
  component: EditExpensePage,
});

function EditExpensePage() {
  const { expenseId }  = Route.useParams();
  const navigate       = useEditNav();
  const { data: expense, isLoading } = useExpense(expenseId);
  const updateExpense  = useUpdateExpense(expenseId);

  const handleSubmit = async (data: Parameters<typeof updateExpense.mutateAsync>[0]) => {
    try {
      await updateExpense.mutateAsync(data as any);
      editToast.success("Expense updated.");
      navigate({ to: "/fuel" });
    } catch (err) {
      editToast.error(err instanceof Error ? err.message : "Failed to update expense.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!expense) {
    return <div className="p-8 text-muted-foreground">Expense not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <EditPageHeader
        title="Edit Expense"
        subtitle={`${expense.category} — ${new Date(expense.expenseDate).toLocaleDateString()}`}
        icon={<ReceiptIcon className="h-6 w-6" />}
        actions={
          <EditLink to="/fuel">
            <EditButton variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </EditButton>
          </EditLink>
        }
      />
      <div className="bg-card border rounded-lg p-6">
        <EditExpenseForm
          initial={expense}
          onSubmit={handleSubmit}
          isLoading={updateExpense.isPending}
        />
      </div>
    </div>
  );
}
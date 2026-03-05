/**
 * types/maintenance.ts — Phase 7
 * Extends base interfaces with create/update/params types.
 */

export type WorkOrderStatus   = "pending" | "in-progress" | "completed" | "overdue";
export type WorkOrderPriority = "low" | "medium" | "high" | "critical";
export type ServiceIntervalType = "km" | "days" | "months";

export interface WorkOrderPart {
  id: string; workOrderId: string; partName: string; partNumber?: string;
  quantity: number; unitCost: number; totalCost: number; currency: string;
}
export interface WorkOrderPartCreate {
  partName: string; partNumber?: string; quantity: number; unitCost: number; currency?: string;
}

export interface WorkOrder {
  id: string; workOrderNumber: string; truckId: string; assignedMechanicId: string;
  status: WorkOrderStatus; priority: WorkOrderPriority; title: string; description: string;
  odometerAtService?: number; scheduledDate: string; completedDate?: string;
  estimatedCost?: number; actualCost?: number; currency: string;
  parts: WorkOrderPart[]; notes?: string; createdBy: string; createdAt: string; updatedAt: string;
  truckPlate?: string; mechanicName?: string; createdByName?: string;
}
export interface WorkOrderCreate {
  truckId: string; assignedMechanicId: string; priority?: WorkOrderPriority;
  title: string; description: string; scheduledDate: string;
  odometerAtService?: number; estimatedCost?: number; currency?: string; notes?: string;
}
export interface WorkOrderUpdate {
  assignedMechanicId?: string; priority?: WorkOrderPriority; title?: string;
  description?: string; scheduledDate?: string; odometerAtService?: number;
  estimatedCost?: number; notes?: string;
}
export interface WorkOrderStatusUpdate {
  status: WorkOrderStatus; completedDate?: string; notes?: string;
}

export interface ServiceSchedule {
  id: string; truckId: string; serviceType: string;
  intervalType: ServiceIntervalType; intervalValue: number;
  lastServiceDate?: string; lastServiceOdometer?: number;
  nextServiceDate?: string; nextServiceOdometer?: number;
  reminderDaysBefore: number; isActive: boolean;
  createdBy: string; createdAt: string; updatedAt: string;
  truckPlate?: string; daysUntilDue?: number;
}
export interface ServiceScheduleCreate {
  truckId: string; serviceType: string;
  intervalType: ServiceIntervalType; intervalValue: number;
  lastServiceDate?: string; lastServiceOdometer?: number;
  nextServiceDate?: string; nextServiceOdometer?: number;
  reminderDaysBefore?: number; isActive?: boolean;
}
export interface ServiceScheduleUpdate {
  serviceType?: string; intervalType?: ServiceIntervalType; intervalValue?: number;
  lastServiceDate?: string; lastServiceOdometer?: number;
  nextServiceDate?: string; nextServiceOdometer?: number;
  reminderDaysBefore?: number; isActive?: boolean;
}

export interface WorkOrderParams {
  page?: number; pageSize?: number; status?: WorkOrderStatus;
  priority?: WorkOrderPriority; truckId?: string; mechanicId?: string; search?: string;
}
export interface ScheduleParams {
  page?: number; pageSize?: number; truckId?: string; isActive?: boolean; dueSoon?: boolean;
}
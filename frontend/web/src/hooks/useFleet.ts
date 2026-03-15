/**
 * hooks/useFleet.ts
 * Fleet Management System
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "../lib/fleet-api";
import apiClient from "../lib/api";
import type { TruckStatus, TrailerStatus } from "../types/fleet";
import type { TruckPayload, TrailerPayload } from "../lib/fleet-api";

// ── Query keys ─────────────────────────────────────────────────────────────────

export const fleetKeys = {
  summary:      ["fleet-summary"]                                as const,
  trucks:       ["trucks"]                                       as const,
  trucksList:   (params: object) => ["trucks", "list", params]  as const,
  truck:        (id: string)     => ["trucks", id]              as const,
  trailers:     ["trailers"]                                     as const,
  trailersList: (params: object) => ["trailers", "list", params] as const,
  trailer:      (id: string)     => ["trailers", id]            as const,
};

// ── Shared params types ────────────────────────────────────────────────────────

export interface TruckListParams {
  page?:     number
  pageSize?: number
  search?:   string
  status?:   TruckStatus
}

export interface TrailerListParams {
  page?:     number
  pageSize?: number
  search?:   string
  status?:   TrailerStatus
}

// ── Fleet Summary ──────────────────────────────────────────────────────────────

export function useFleetSummary() {
  return useQuery({
    queryKey: fleetKeys.summary,
    queryFn:  api.getFleetSummary,
  });
}

// ── Trucks ─────────────────────────────────────────────────────────────────────

export function useTrucks(params: TruckListParams = {}) {
  const { page = 1, pageSize = 20, search, status } = params
  return useQuery({
    queryKey:        fleetKeys.trucksList({ page, pageSize, search, status }),
    queryFn:         () => api.listTrucks(status, { page, pageSize, search }),
    placeholderData: keepPreviousData,
  });
}

export function useTruck(id: string) {
  return useQuery({
    queryKey: fleetKeys.truck(id),
    queryFn:  () => api.getTruck(id),
    enabled:  !!id,
  });
}

export function useCreateTruck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TruckPayload) => api.createTruck(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fleetKeys.trucks });
      qc.invalidateQueries({ queryKey: fleetKeys.summary });
      toast.success("Truck added successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTruck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<TruckPayload> & { id: string }) =>
      api.updateTruck(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: fleetKeys.trucks });
      qc.invalidateQueries({ queryKey: fleetKeys.truck(id) });
      qc.invalidateQueries({ queryKey: fleetKeys.summary });
      toast.success("Truck updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTruck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTruck(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fleetKeys.trucks });
      qc.invalidateQueries({ queryKey: fleetKeys.summary });
      toast.success("Truck deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Trailers ───────────────────────────────────────────────────────────────────

export function useTrailers(params: TrailerListParams = {}) {
  const { page = 1, pageSize = 20, search, status } = params
  return useQuery({
    queryKey:        fleetKeys.trailersList({ page, pageSize, search, status }),
    queryFn:         () => api.listTrailers(status, { page, pageSize, search }),
    placeholderData: keepPreviousData,
  });
}

export function useTrailer(id: string) {
  return useQuery({
    queryKey: fleetKeys.trailer(id),
    queryFn:  () => api.getTrailer(id),
    enabled:  !!id,
  });
}

export function useCreateTrailer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TrailerPayload) => api.createTrailer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fleetKeys.trailers });
      qc.invalidateQueries({ queryKey: fleetKeys.summary });
      toast.success("Trailer added successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTrailer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<TrailerPayload> & { id: string }) =>
      api.updateTrailer(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: fleetKeys.trailers });
      qc.invalidateQueries({ queryKey: fleetKeys.trailer(id) });
      qc.invalidateQueries({ queryKey: fleetKeys.summary });
      toast.success("Trailer updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTrailer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTrailer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fleetKeys.trailers });
      qc.invalidateQueries({ queryKey: fleetKeys.summary });
      toast.success("Trailer deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Truck image upload ─────────────────────────────────────────────────────────

export function useUploadTruckImage(truckId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiClient
        .post(`/api/v1/fleet/trucks/${truckId}/image`, fd, {
          headers: { 'Content-Type': undefined },
        })
        .then(r => r.data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fleetKeys.truck(truckId) })
      qc.invalidateQueries({ queryKey: fleetKeys.trucks })
    },
  })
}

// ── Trailer image upload ───────────────────────────────────────────────────────

export function useUploadTrailerImage(trailerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiClient
        .post(`/api/v1/fleet/trailers/${trailerId}/image`, fd, {
          headers: { 'Content-Type': undefined },
        })
        .then(r => r.data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fleetKeys.trailer(trailerId) })
      qc.invalidateQueries({ queryKey: fleetKeys.trailers })
    },
  })
}
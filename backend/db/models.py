"""
db/models.py
Fleet Management System

Changes in this revision (Stage 2–3):
  - Truck: added wheel_config, gross_weight_tons, axle_load_tons (nullable)
  - Truck: added `trips` relationship backref (→ Trip.assigned_truck)
  - Trailer: added axles (nullable Integer)
  - Trip: updated assigned_truck relationship to back_populates="trips"
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, Text, JSON,
    ForeignKey, Enum as SAEnum, func, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.base import Base


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def gen_uuid() -> str:
    return str(uuid.uuid4())


TZ  = DateTime(timezone=True)
NTZ = DateTime(timezone=False)


# ─────────────────────────────────────────────────────────────────────────────
# ENUMS
# ─────────────────────────────────────────────────────────────────────────────

UserRoleEnum = SAEnum(
    "ADMIN", "DISPATCHER", "DRIVER", "MECHANIC", "FINANCE",
    name="userrole"
)

UserStatusEnum = SAEnum(
    "active", "inactive", "pending",
    name="userstatus"
)

TruckStatusEnum = SAEnum(
    "active", "inactive", "in-progress", "under-maintenance",
    name="truckstatus"
)

TrailerStatusEnum = SAEnum(
    "active", "inactive", "under-maintenance",
    name="trailerstatus"
)

TrailerTypeEnum = SAEnum(
    "flatbed", "refrigerated", "tanker", "box", "other",
    name="trailertype"
)

FuelTypeEnum = SAEnum(
    "diesel", "petrol", "electric", "hybrid",
    name="fueltype"
)

DriverStatusEnum = SAEnum(
    "active", "inactive", "on-leave", "suspended",
    name="driverstatus"
)

TripStatusEnum = SAEnum(
    "pending", "en-route", "completed", "cancelled",
    name="tripstatus"
)

WorkOrderStatusEnum = SAEnum(
    "pending", "in-progress", "completed", "overdue",
    name="workorderstatus"
)

WorkOrderPriorityEnum = SAEnum(
    "low", "medium", "high", "critical",
    name="workorderpriority"
)

ServiceIntervalEnum = SAEnum(
    "km", "days", "months",
    name="serviceintervaltype"
)

VehicleDocTypeEnum = SAEnum(
    "insurance", "registration", "inspection", "other",
    name="vehicledoctype"
)

DriverDocTypeEnum = SAEnum(
    "license", "medical", "contract", "certificate", "other",
    name="driverdoctype"
)

ExpenseCategoryEnum = SAEnum(
    "fuel", "maintenance", "tolls", "tyres",
    "insurance", "licensing", "salary", "other",
    name="expensecategory"
)

IncidentTypeEnum = SAEnum(
    "accident", "breakdown", "theft", "traffic_violation",
    "near_miss", "property_damage", "other",
    name="incidenttype",
)

IncidentSeverityEnum = SAEnum(
    "low", "medium", "high", "critical",
    name="incidentseverity",
)

IncidentStatusEnum = SAEnum(
    "open", "under_review", "resolved", "closed",
    name="incidentstatus",
)

# ─────────────────────────────────────────────────────────────────────────────
# USERS
# ─────────────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id:            Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    first_name:    Mapped[str]            = mapped_column(String(80))
    last_name:     Mapped[str]            = mapped_column(String(80))
    email:         Mapped[str]            = mapped_column(String(120), unique=True, index=True)
    password:      Mapped[Optional[str]]  = mapped_column(String(200), nullable=True)
    role:          Mapped[str]            = mapped_column(UserRoleEnum, default="DRIVER")
    status:        Mapped[str]            = mapped_column(UserStatusEnum, default="active")
    is_active:     Mapped[bool]           = mapped_column(Boolean, default=True)
    is_verified:   Mapped[bool]           = mapped_column(Boolean, default=False)
    phone:         Mapped[Optional[str]]  = mapped_column(String(30), nullable=True)
    avatar_url:    Mapped[Optional[str]]  = mapped_column(String(500), nullable=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)

    email_verification_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reset_password_token:     Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now(), onupdate=func.now())

    user_oauth:     Mapped[list["UserOAuth"]]  = relationship("UserOAuth", back_populates="user", cascade="all, delete-orphan")
    driver_profile: Mapped[Optional["Driver"]] = relationship("Driver", back_populates="user", uselist=False)


class UserOAuth(Base):
    __tablename__ = "user_oauth"

    id:               Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id:          Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    provider:         Mapped[str] = mapped_column(String(50), default="google")
    provider_user_id: Mapped[str] = mapped_column(String, index=True)
    provider_email:   Mapped[str] = mapped_column(String(120))
    access_token:     Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    refresh_token:    Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    expires_at:       Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    created_at:       Mapped[datetime] = mapped_column(TZ, server_default=func.now())

    user: Mapped[User] = relationship("User", back_populates="user_oauth")

    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_provider_user"),
    )


class RefreshTokens(Base):
    __tablename__ = "refresh_tokens"

    id:         Mapped[str]      = mapped_column(String(36), primary_key=True, default=gen_uuid)
    token:      Mapped[str]      = mapped_column(String(500), unique=True, index=True)
    user_id:    Mapped[str]      = mapped_column(String(36), ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(TZ)
    is_revoked: Mapped[bool]     = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# FLEET — TRUCKS
# ─────────────────────────────────────────────────────────────────────────────

class Truck(Base):
    __tablename__ = "trucks"

    id:                     Mapped[str]   = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    plate_number:           Mapped[str]   = mapped_column(String(20), unique=True, index=True)
    make:                   Mapped[str]   = mapped_column(String(80))
    model:                  Mapped[str]   = mapped_column(String(80))
    year:                   Mapped[int]   = mapped_column(Integer)
    status:                 Mapped[str]   = mapped_column(TruckStatusEnum, default="active")
    odometer_km:            Mapped[float] = mapped_column(Float, default=0.0)
    fuel_type:              Mapped[str]   = mapped_column(FuelTypeEnum, default="diesel")
    vin:                    Mapped[Optional[str]]      = mapped_column(String(50),  nullable=True)
    color:                  Mapped[Optional[str]]      = mapped_column(String(40),  nullable=True)
    assigned_driver_id:     Mapped[Optional[str]]      = mapped_column(String(36),  ForeignKey("users.id"), nullable=True)
    current_trip_id:        Mapped[Optional[str]]      = mapped_column(String(36),  nullable=True)
    insurance_expiry_date:  Mapped[Optional[datetime]] = mapped_column(TZ,          nullable=True)
    inspection_expiry_date: Mapped[Optional[datetime]] = mapped_column(TZ,          nullable=True)
    notes:                  Mapped[Optional[str]]      = mapped_column(Text,         nullable=True)
    # ── Stage 2: catalog spec columns ──────────────────────────────────────
    wheel_config:           Mapped[Optional[str]]   = mapped_column(String(20), nullable=True)
    gross_weight_tons:      Mapped[Optional[float]] = mapped_column(Float,      nullable=True)
    axle_load_tons:         Mapped[Optional[float]] = mapped_column(Float,      nullable=True)
    # ── Stage 4: vehicle image ──────────────────────────────────────────────
    image_url:              Mapped[Optional[str]]   = mapped_column(String(500), nullable=True)
    # ───────────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now(), onupdate=func.now())

    documents:         Mapped[list["TruckDocument"]]   = relationship("TruckDocument",   back_populates="truck",  cascade="all, delete-orphan")
    service_records:   Mapped[list["ServiceRecord"]]   = relationship("ServiceRecord",   back_populates="truck",  cascade="all, delete-orphan")
    service_schedules: Mapped[list["ServiceSchedule"]] = relationship("ServiceSchedule", back_populates="truck",  cascade="all, delete-orphan")
    fuel_logs:         Mapped[list["FuelLog"]]         = relationship("FuelLog",         back_populates="truck")
    work_orders:       Mapped[list["WorkOrder"]]       = relationship("WorkOrder",       back_populates="truck")
    trips:             Mapped[list["Trip"]]            = relationship("Trip",            back_populates="assigned_truck",  foreign_keys="[Trip.assigned_truck_id]", lazy="select",)
    incidents: Mapped[list["Incident"]] = relationship("Incident", back_populates="truck", foreign_keys="[Incident.truck_id]")


class TruckDocument(Base):
    __tablename__ = "truck_documents"

    id:          Mapped[str]               = mapped_column(String(36), primary_key=True, default=gen_uuid)
    truck_id:    Mapped[str]               = mapped_column(String(36), ForeignKey("trucks.id"))
    type:        Mapped[str]               = mapped_column(VehicleDocTypeEnum)
    file_name:   Mapped[str]               = mapped_column(String(255))
    file_url:    Mapped[str]               = mapped_column(String(500))
    expiry_date: Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    uploaded_at: Mapped[datetime]           = mapped_column(TZ, server_default=func.now())
    uploaded_by: Mapped[str]               = mapped_column(String(36), ForeignKey("users.id"))

    truck: Mapped[Truck] = relationship("Truck", back_populates="documents")


class ServiceRecord(Base):
    __tablename__ = "service_records"

    id:                  Mapped[str]   = mapped_column(String(36), primary_key=True, default=gen_uuid)
    truck_id:            Mapped[str]   = mapped_column(String(36), ForeignKey("trucks.id"))
    service_type:        Mapped[str]   = mapped_column(String(100))
    description:         Mapped[str]   = mapped_column(Text)
    odometer_at_service: Mapped[float] = mapped_column(Float)
    cost:                Mapped[float] = mapped_column(Float, default=0.0)
    performed_by:        Mapped[str]   = mapped_column(String(36), ForeignKey("users.id"))
    work_order_id:       Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("work_orders.id"), nullable=True)
    service_date:        Mapped[datetime] = mapped_column(TZ)
    created_at:          Mapped[datetime] = mapped_column(TZ, server_default=func.now())

    truck: Mapped[Truck] = relationship("Truck", back_populates="service_records")


# ─────────────────────────────────────────────────────────────────────────────
# FLEET — TRAILERS
# ─────────────────────────────────────────────────────────────────────────────

class Trailer(Base):
    __tablename__ = "trailers"

    id:                     Mapped[str]   = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    plate_number:           Mapped[str]   = mapped_column(String(20), unique=True, index=True)
    make:                   Mapped[str]   = mapped_column(String(80))
    model:                  Mapped[str]   = mapped_column(String(80))
    year:                   Mapped[int]   = mapped_column(Integer)
    status:                 Mapped[str]   = mapped_column(TrailerStatusEnum, default="active")
    type:                   Mapped[str]   = mapped_column(TrailerTypeEnum)
    capacity_tons:          Mapped[Optional[float]]    = mapped_column(Float,    nullable=True)
    assigned_trip_id:       Mapped[Optional[str]]      = mapped_column(String(36), nullable=True)
    insurance_expiry_date:  Mapped[Optional[datetime]] = mapped_column(TZ,         nullable=True)
    inspection_expiry_date: Mapped[Optional[datetime]] = mapped_column(TZ,         nullable=True)
    notes:                  Mapped[Optional[str]]      = mapped_column(Text,        nullable=True)
    # ── Stage 2: catalog spec column ───────────────────────────────────────
    axles:                  Mapped[Optional[int]]      = mapped_column(Integer, nullable=True)
    # ── Stage 4: vehicle image ──────────────────────────────────────────────
    image_url:              Mapped[Optional[str]]      = mapped_column(String(500), nullable=True)
    # ───────────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TZ, server_default=func.now(), onupdate=func.now())

    documents: Mapped[list["TrailerDocument"]] = relationship("TrailerDocument", back_populates="trailer", cascade="all, delete-orphan")


class TrailerDocument(Base):
    __tablename__ = "trailer_documents"

    id:          Mapped[str]               = mapped_column(String(36), primary_key=True, default=gen_uuid)
    trailer_id:  Mapped[str]               = mapped_column(String(36), ForeignKey("trailers.id"))
    type:        Mapped[str]               = mapped_column(VehicleDocTypeEnum)
    file_name:   Mapped[str]               = mapped_column(String(255))
    file_url:    Mapped[str]               = mapped_column(String(500))
    expiry_date: Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    uploaded_at: Mapped[datetime]           = mapped_column(TZ, server_default=func.now())
    uploaded_by: Mapped[str]               = mapped_column(String(36), ForeignKey("users.id"))

    trailer: Mapped[Trailer] = relationship("Trailer", back_populates="documents")


# ─────────────────────────────────────────────────────────────────────────────
# DRIVERS
# ─────────────────────────────────────────────────────────────────────────────

class Driver(Base):
    __tablename__ = "drivers"

    id:                      Mapped[str]               = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    user_id:                 Mapped[str]               = mapped_column(String(36), ForeignKey("users.id"), unique=True)
    first_name:              Mapped[str]               = mapped_column(String(80))
    last_name:               Mapped[str]               = mapped_column(String(80))
    email:                   Mapped[str]               = mapped_column(String(120))
    phone:                   Mapped[str]               = mapped_column(String(30))
    status:                  Mapped[str]               = mapped_column(DriverStatusEnum, default="active")
    license_number:          Mapped[str]               = mapped_column(String(50), unique=True)
    license_class:           Mapped[str]               = mapped_column(String(20))
    license_expiry_date:     Mapped[datetime]           = mapped_column(TZ)
    date_of_birth:           Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    national_id:             Mapped[Optional[str]]      = mapped_column(String(50), nullable=True)
    address:                 Mapped[Optional[str]]      = mapped_column(Text,        nullable=True)
    emergency_contact_name:  Mapped[Optional[str]]      = mapped_column(String(120), nullable=True)
    emergency_contact_phone: Mapped[Optional[str]]      = mapped_column(String(30),  nullable=True)
    hire_date:               Mapped[datetime]           = mapped_column(TZ)
    avatar_url:              Mapped[Optional[str]]      = mapped_column(String(500), nullable=True)
    notes:                   Mapped[Optional[str]]      = mapped_column(Text,        nullable=True)
    created_at:              Mapped[datetime]           = mapped_column(TZ, server_default=func.now())
    updated_at:              Mapped[datetime]           = mapped_column(TZ, server_default=func.now(), onupdate=func.now())

    user:      Mapped["User"]                 = relationship("User",           back_populates="driver_profile")
    documents: Mapped[list["DriverDocument"]] = relationship("DriverDocument", back_populates="driver", cascade="all, delete-orphan")
    fuel_logs: Mapped[list["FuelLog"]]        = relationship("FuelLog",        back_populates="driver")
    trips:     Mapped[list["Trip"]]           = relationship("Trip",           back_populates="assigned_driver", foreign_keys="[Trip.assigned_driver_id]")
    incidents: Mapped[list["Incident"]] = relationship("Incident", back_populates="driver", foreign_keys="[Incident.driver_id]")

class DriverDocument(Base):
    __tablename__ = "driver_documents"

    id:          Mapped[str]               = mapped_column(String(36), primary_key=True, default=gen_uuid)
    driver_id:   Mapped[str]               = mapped_column(String(36), ForeignKey("drivers.id"))
    type:        Mapped[str]               = mapped_column(DriverDocTypeEnum)
    file_name:   Mapped[str]               = mapped_column(String(255))
    file_url:    Mapped[str]               = mapped_column(String(500))
    expiry_date: Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    uploaded_at: Mapped[datetime]           = mapped_column(TZ, server_default=func.now())
    uploaded_by: Mapped[str]               = mapped_column(String(36), ForeignKey("users.id"))

    driver: Mapped[Driver] = relationship("Driver", back_populates="documents")


# ─────────────────────────────────────────────────────────────────────────────
# TRIPS
# ─────────────────────────────────────────────────────────────────────────────

class Trip(Base):
    __tablename__ = "trips"

    id:                  Mapped[str]               = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    trip_number:         Mapped[str]               = mapped_column(String(20), unique=True, index=True)
    status:              Mapped[str]               = mapped_column(TripStatusEnum, default="pending")
    origin:              Mapped[str]               = mapped_column(String(200))
    destination:         Mapped[str]               = mapped_column(String(200))
    scheduled_departure: Mapped[datetime]           = mapped_column(TZ)
    scheduled_arrival:   Mapped[datetime]           = mapped_column(TZ)
    actual_departure:    Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    actual_arrival:      Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    distance_km:         Mapped[Optional[float]]   = mapped_column(Float, nullable=True)
    cargo_description:   Mapped[Optional[str]]     = mapped_column(Text,  nullable=True)
    cargo_weight_tons:   Mapped[Optional[float]]   = mapped_column(Float, nullable=True)
    assigned_truck_id:   Mapped[Optional[str]]     = mapped_column(String(36), ForeignKey("trucks.id"),   nullable=True)
    assigned_trailer_id: Mapped[Optional[str]]     = mapped_column(String(36), ForeignKey("trailers.id"), nullable=True)
    assigned_driver_id:  Mapped[Optional[str]]     = mapped_column(String(36), ForeignKey("drivers.id"),  nullable=True)
    dispatched_by:       Mapped[str]               = mapped_column(String(36), ForeignKey("users.id"))
    notes:               Mapped[Optional[str]]     = mapped_column(Text,  nullable=True)
    origin_lat:          Mapped[Optional[float]]   = mapped_column(Float, nullable=True)
    origin_lng:          Mapped[Optional[float]]   = mapped_column(Float, nullable=True)
    destination_lat:     Mapped[Optional[float]]   = mapped_column(Float, nullable=True)
    destination_lng:     Mapped[Optional[float]]   = mapped_column(Float, nullable=True)
    created_at:          Mapped[datetime]           = mapped_column(TZ, server_default=func.now())
    updated_at:          Mapped[datetime]           = mapped_column(TZ, server_default=func.now(), onupdate=func.now())

    # Stage 3: back_populates added to assigned_truck so Truck.trips works
    assigned_truck:   Mapped[Optional["Truck"]]   = relationship("Truck",   back_populates="trips",           foreign_keys=[assigned_truck_id])
    assigned_trailer: Mapped[Optional["Trailer"]] = relationship("Trailer",                                   foreign_keys=[assigned_trailer_id])
    assigned_driver:  Mapped[Optional["Driver"]]  = relationship("Driver",  back_populates="trips",           foreign_keys=[assigned_driver_id])
    incidents: Mapped[list["Incident"]] = relationship("Incident", back_populates="trip", foreign_keys="[Incident.trip_id]")

class TripLocationPing(Base):
    __tablename__ = "trip_location_pings"

    id:          Mapped[str]             = mapped_column(String(36), primary_key=True, default=gen_uuid)
    trip_id:     Mapped[str]             = mapped_column(String(36), ForeignKey("trips.id"), index=True)
    lat:         Mapped[float]           = mapped_column(Float)
    lng:         Mapped[float]           = mapped_column(Float)
    recorded_at: Mapped[datetime]         = mapped_column(TZ, server_default=func.now())
    recorded_by: Mapped[str]             = mapped_column(String(36), ForeignKey("users.id"))
    accuracy_m:  Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes:       Mapped[Optional[str]]   = mapped_column(Text,  nullable=True)

    trip: Mapped["Trip"] = relationship("Trip")


# ─────────────────────────────────────────────────────────────────────────────
# FUEL & COSTS
# ─────────────────────────────────────────────────────────────────────────────

class FuelLog(Base):
    __tablename__ = "fuel_logs"

    id:               Mapped[str]   = mapped_column(String(36), primary_key=True, default=gen_uuid)
    truck_id:         Mapped[str]   = mapped_column(String(36), ForeignKey("trucks.id"))
    driver_id:        Mapped[str]   = mapped_column(String(36), ForeignKey("drivers.id"))
    trip_id:          Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("trips.id"), nullable=True)
    litres:           Mapped[float] = mapped_column(Float)
    price_per_litre:  Mapped[float] = mapped_column(Float)
    total_cost:       Mapped[float] = mapped_column(Float)
    currency:         Mapped[str]   = mapped_column(String(3), default="USD")
    odometer_at_fuel: Mapped[float] = mapped_column(Float)
    station_name:     Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    station_location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    receipt_url:      Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    logged_at:        Mapped[datetime] = mapped_column(TZ)
    created_at:       Mapped[datetime] = mapped_column(TZ, server_default=func.now())
    updated_at:       Mapped[datetime] = mapped_column(TZ, server_default=func.now(), onupdate=func.now())

    truck:  Mapped[Truck]  = relationship("Truck",  back_populates="fuel_logs")
    driver: Mapped[Driver] = relationship("Driver", back_populates="fuel_logs")


class Expense(Base):
    __tablename__ = "expenses"

    id:           Mapped[str]   = mapped_column(String(36), primary_key=True, default=gen_uuid)
    category:     Mapped[str]   = mapped_column(ExpenseCategoryEnum)
    amount:       Mapped[float] = mapped_column(Float)
    currency:     Mapped[str]   = mapped_column(String(3), default="USD")
    description:  Mapped[str]   = mapped_column(Text)
    truck_id:     Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("trucks.id"),   nullable=True)
    driver_id:    Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("drivers.id"),  nullable=True)
    trip_id:      Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("trips.id"),    nullable=True)
    receipt_url:  Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    expense_date: Mapped[datetime] = mapped_column(TZ)
    created_by:   Mapped[str]   = mapped_column(String(36), ForeignKey("users.id"))
    created_at:   Mapped[datetime] = mapped_column(TZ, server_default=func.now())
    updated_at:   Mapped[datetime] = mapped_column(TZ, server_default=func.now(), onupdate=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# MAINTENANCE
# ─────────────────────────────────────────────────────────────────────────────

class WorkOrder(Base):
    __tablename__ = "work_orders"

    id:                   Mapped[str]               = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    work_order_number:    Mapped[str]               = mapped_column(String(20), unique=True, index=True)
    truck_id:             Mapped[str]               = mapped_column(String(36), ForeignKey("trucks.id"))
    assigned_mechanic_id: Mapped[str]               = mapped_column(String(36), ForeignKey("users.id"))
    status:               Mapped[str]               = mapped_column(WorkOrderStatusEnum, default="pending")
    priority:             Mapped[str]               = mapped_column(WorkOrderPriorityEnum, default="medium")
    title:                Mapped[str]               = mapped_column(String(200))
    description:          Mapped[str]               = mapped_column(Text)
    odometer_at_service:  Mapped[Optional[float]]   = mapped_column(Float, nullable=True)
    scheduled_date:       Mapped[datetime]           = mapped_column(TZ)
    completed_date:       Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    estimated_cost:       Mapped[Optional[float]]   = mapped_column(Float, nullable=True)
    actual_cost:          Mapped[Optional[float]]   = mapped_column(Float, nullable=True)
    currency:             Mapped[str]               = mapped_column(String(3), default="USD")
    notes:                Mapped[Optional[str]]     = mapped_column(Text, nullable=True)
    created_by:           Mapped[str]               = mapped_column(String(36), ForeignKey("users.id"))
    created_at:           Mapped[datetime]           = mapped_column(TZ, server_default=func.now())
    updated_at:           Mapped[datetime]           = mapped_column(TZ, server_default=func.now(), onupdate=func.now())

    truck:           Mapped["Truck"]               = relationship("Truck", back_populates="work_orders")
    parts:           Mapped[list["WorkOrderPart"]] = relationship("WorkOrderPart", back_populates="work_order", cascade="all, delete-orphan")
    service_records: Mapped[list["ServiceRecord"]] = relationship("ServiceRecord", back_populates=None, foreign_keys="ServiceRecord.work_order_id")


class WorkOrderPart(Base):
    __tablename__ = "work_order_parts"

    id:            Mapped[str]   = mapped_column(String(36), primary_key=True, default=gen_uuid)
    work_order_id: Mapped[str]   = mapped_column(String(36), ForeignKey("work_orders.id"))
    part_name:     Mapped[str]   = mapped_column(String(120))
    part_number:   Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    quantity:      Mapped[int]   = mapped_column(Integer)
    unit_cost:     Mapped[float] = mapped_column(Float)
    total_cost:    Mapped[float] = mapped_column(Float)
    currency:      Mapped[str]   = mapped_column(String(3), default="USD")

    work_order: Mapped[WorkOrder] = relationship("WorkOrder", back_populates="parts")


class ServiceSchedule(Base):
    __tablename__ = "service_schedules"

    id:                    Mapped[str]               = mapped_column(String(36), primary_key=True, default=gen_uuid)
    truck_id:              Mapped[str]               = mapped_column(String(36), ForeignKey("trucks.id"))
    service_type:          Mapped[str]               = mapped_column(String(100))
    interval_type:         Mapped[str]               = mapped_column(ServiceIntervalEnum)
    interval_value:        Mapped[int]               = mapped_column(Integer)
    last_service_date:     Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    last_service_odometer: Mapped[Optional[float]]   = mapped_column(Float, nullable=True)
    next_service_date:     Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    next_service_odometer: Mapped[Optional[float]]   = mapped_column(Float, nullable=True)
    reminder_days_before:  Mapped[int]               = mapped_column(Integer, default=7)
    is_active:             Mapped[bool]              = mapped_column(Boolean, default=True)
    created_by:            Mapped[str]               = mapped_column(String(36), ForeignKey("users.id"))
    created_at:            Mapped[datetime]           = mapped_column(TZ, server_default=func.now())
    updated_at:            Mapped[datetime]           = mapped_column(TZ, server_default=func.now(), onupdate=func.now())

    truck: Mapped[Truck] = relationship("Truck", back_populates="service_schedules")

# ─────────────────────────────────────────────────────────────────────────────
# INCIDENTS
# ─────────────────────────────────────────────────────────────────────────────
class Incident(Base):
    __tablename__ = "incidents"

    id:               Mapped[str]               = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    incident_number:  Mapped[str]               = mapped_column(String(20), unique=True, index=True)
    title:            Mapped[str]               = mapped_column(String(200))
    description:      Mapped[str]               = mapped_column(Text)
    type:             Mapped[str]               = mapped_column(IncidentTypeEnum)
    severity:         Mapped[str]               = mapped_column(IncidentSeverityEnum)
    status:           Mapped[str]               = mapped_column(IncidentStatusEnum, default="open")
    incident_date:    Mapped[datetime]           = mapped_column(TZ)
    location:         Mapped[Optional[str]]      = mapped_column(String(200), nullable=True)
    location_lat:     Mapped[Optional[float]]    = mapped_column(Float,       nullable=True)
    location_lng:     Mapped[Optional[float]]    = mapped_column(Float,       nullable=True)
    # Optional links — any or all may be set
    driver_id:        Mapped[Optional[str]]      = mapped_column(String(36), ForeignKey("drivers.id"),  nullable=True)
    truck_id:         Mapped[Optional[str]]      = mapped_column(String(36), ForeignKey("trucks.id"),   nullable=True)
    trailer_id:       Mapped[Optional[str]]      = mapped_column(String(36), ForeignKey("trailers.id"), nullable=True)
    trip_id:          Mapped[Optional[str]]      = mapped_column(String(36), ForeignKey("trips.id"),    nullable=True)
    reported_by:      Mapped[str]               = mapped_column(String(36), ForeignKey("users.id"))
    resolution_notes: Mapped[Optional[str]]      = mapped_column(Text,       nullable=True)
    resolved_at:      Mapped[Optional[datetime]] = mapped_column(TZ,         nullable=True)
    resolved_by:      Mapped[Optional[str]]      = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at:       Mapped[datetime]           = mapped_column(TZ, server_default=func.now())
    updated_at:       Mapped[datetime]           = mapped_column(TZ, server_default=func.now(), onupdate=func.now())

    reporter:    Mapped["User"]                       = relationship("User",    foreign_keys=[reported_by])
    resolver:    Mapped[Optional["User"]]             = relationship("User",    foreign_keys=[resolved_by])
    driver:      Mapped[Optional["Driver"]]           = relationship("Driver",  foreign_keys=[driver_id])
    truck:       Mapped[Optional["Truck"]]            = relationship("Truck",   foreign_keys=[truck_id])
    trailer:     Mapped[Optional["Trailer"]]          = relationship("Trailer", foreign_keys=[trailer_id])
    trip:        Mapped[Optional["Trip"]]             = relationship("Trip",    foreign_keys=[trip_id])
    attachments: Mapped[list["IncidentAttachment"]]   = relationship(
        "IncidentAttachment", back_populates="incident", cascade="all, delete-orphan"
    )


class IncidentAttachment(Base):
    __tablename__ = "incident_attachments"

    id:          Mapped[str]               = mapped_column(String(36), primary_key=True, default=gen_uuid)
    incident_id: Mapped[str]               = mapped_column(String(36), ForeignKey("incidents.id"))
    file_name:   Mapped[str]               = mapped_column(String(255))
    file_url:    Mapped[str]               = mapped_column(String(500))
    file_type:   Mapped[Optional[str]]     = mapped_column(String(50), nullable=True)
    uploaded_by: Mapped[str]               = mapped_column(String(36), ForeignKey("users.id"))
    uploaded_at: Mapped[datetime]          = mapped_column(TZ, server_default=func.now())

    incident: Mapped["Incident"] = relationship("Incident", back_populates="attachments")

# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM SETTINGS
# ─────────────────────────────────────────────────────────────────────────────

class SystemSettings(Base):
    __tablename__ = "system_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: "global")

    org_name:     Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    org_timezone: Mapped[str]           = mapped_column(String(50), default="UTC")
    date_format:  Mapped[str]           = mapped_column(String(20), default="ISO")

    currency:      Mapped[str] = mapped_column(String(3),  default="USD")
    fuel_unit:     Mapped[str] = mapped_column(String(20), default="gallons")
    distance_unit: Mapped[str] = mapped_column(String(20), default="miles")

    maintenance_warning_days:     Mapped[int] = mapped_column(Integer, default=7)
    license_expiry_warning_days:  Mapped[int] = mapped_column(Integer, default=30)
    document_expiry_warning_days: Mapped[int] = mapped_column(Integer, default=14)

    email_alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    maintenance_alerts:   Mapped[bool] = mapped_column(Boolean, default=True)
    trip_status_alerts:   Mapped[bool] = mapped_column(Boolean, default=True)

    theme:            Mapped[str] = mapped_column(String(20), default="system")
    default_language: Mapped[str] = mapped_column(String(10), default="en")

    updated_at: Mapped[datetime]      = mapped_column(TZ, server_default=func.now(), onupdate=func.now())
    updated_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    updater: Mapped[Optional["User"]] = relationship("User", foreign_keys=[updated_by])


# ─────────────────────────────────────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────────────────────────────────────

NotificationTypeEnum = SAEnum(
    "trip_assigned",
    "trip_status_changed",
    "work_order_assigned",
    "maintenance_due",
    "document_expiring",
    "fuel_logged",
    "expense_submitted",
    "system",
    name="notificationtype",
)


class Notification(Base):
    __tablename__ = "notifications"

    id:          Mapped[str]           = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    user_id:     Mapped[str]           = mapped_column(String(36), ForeignKey("users.id"), index=True)
    type:        Mapped[str]           = mapped_column(NotificationTypeEnum)
    title:       Mapped[str]           = mapped_column(String(200))
    message:     Mapped[str]           = mapped_column(Text)
    is_read:     Mapped[bool]          = mapped_column(Boolean, default=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50),  nullable=True)
    entity_id:   Mapped[Optional[str]] = mapped_column(String(36),  nullable=True)
    action_url:  Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    created_at:  Mapped[datetime]      = mapped_column(TZ, server_default=func.now())

    recipient: Mapped["User"] = relationship("User", foreign_keys=[user_id])


# ------------------------------------------------------------------------------
# ANALYTICS & INTELLIGENCE
# ------------------------------------------------------------------------------

class VehicleTelemetrySnapshot(Base):
    __tablename__ = "vehicle_telemetry_snapshots"

    id:                Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    truck_id:          Mapped[str]            = mapped_column(String(36), ForeignKey("trucks.id"), index=True)
    recorded_at:       Mapped[datetime]       = mapped_column(TZ, index=True)
    odometer_km:       Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    engine_temp_c:     Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    tire_pressure_avg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    battery_voltage:   Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fuel_rate:         Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speed_avg:         Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at:        Mapped[datetime]       = mapped_column(TZ, server_default=func.now())


class VehicleHealthScore(Base):
    __tablename__ = "vehicle_health_scores"

    id:                   Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    truck_id:             Mapped[str]            = mapped_column(String(36), ForeignKey("trucks.id"), index=True)
    score:                Mapped[float]          = mapped_column(Float)
    risk_level:           Mapped[str]            = mapped_column(String(20), default="low", index=True)
    predicted_issue_type: Mapped[Optional[str]]  = mapped_column(String(120), nullable=True)
    confidence:           Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    details:              Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    generated_at:         Mapped[datetime]       = mapped_column(TZ, index=True)
    created_at:           Mapped[datetime]       = mapped_column(TZ, server_default=func.now())


class MaintenancePrediction(Base):
    __tablename__ = "maintenance_predictions"

    id:                  Mapped[str]             = mapped_column(String(36), primary_key=True, default=gen_uuid)
    truck_id:            Mapped[str]             = mapped_column(String(36), ForeignKey("trucks.id"), index=True)
    source_window_start: Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    source_window_end:   Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    recommended_action:  Mapped[str]             = mapped_column(String(255))
    due_by_date:         Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    due_by_odometer:     Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    severity:            Mapped[str]             = mapped_column(String(20), default="medium", index=True)
    explanation:         Mapped[Optional[str]]   = mapped_column(Text, nullable=True)
    status:              Mapped[str]             = mapped_column(String(20), default="open", index=True)
    created_at:          Mapped[datetime]        = mapped_column(TZ, server_default=func.now())
    generated_at:        Mapped[datetime]        = mapped_column(TZ, index=True)


class AnomalyEvent(Base):
    __tablename__ = "anomaly_events"

    id:                Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    entity_type:       Mapped[str]            = mapped_column(String(50), index=True)
    entity_id:         Mapped[str]            = mapped_column(String(36), index=True)
    metric_name:       Mapped[str]            = mapped_column(String(100), index=True)
    observed_value:    Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    baseline_value:    Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    anomaly_score:     Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    severity:          Mapped[str]            = mapped_column(String(20), default="medium", index=True)
    summary:           Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    detected_at:       Mapped[datetime]       = mapped_column(TZ, index=True)
    resolution_status: Mapped[str]            = mapped_column(String(20), default="open", index=True)
    metadata_json:     Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at:        Mapped[datetime]       = mapped_column(TZ, server_default=func.now())


# ------------------------------------------------------------------------------
# ROUTE OPTIMIZATION
# ------------------------------------------------------------------------------

class RoutePlan(Base):
    __tablename__ = "route_plans"

    id:                  Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    trip_id:             Mapped[str]            = mapped_column(String(36), ForeignKey("trips.id"), unique=True, index=True)
    origin_lat:          Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    origin_lng:          Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    destination_lat:     Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    destination_lng:     Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    route_geometry_ref:  Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    distance_km:         Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    duration_secs:       Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    eta_at:              Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    optimization_source: Mapped[str]            = mapped_column(String(50), default="osrm")
    score:               Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    generated_at:        Mapped[datetime]       = mapped_column(TZ, index=True)
    created_at:          Mapped[datetime]       = mapped_column(TZ, server_default=func.now())


class RouteAlternative(Base):
    __tablename__ = "route_alternatives"

    id:             Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    route_plan_id:  Mapped[str]            = mapped_column(String(36), ForeignKey("route_plans.id"), index=True)
    label:          Mapped[str]            = mapped_column(String(120))
    geometry_ref:   Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    distance_km:    Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    duration_secs:  Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fuel_estimate:  Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rank:           Mapped[int]            = mapped_column(Integer, default=1)
    notes:          Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    created_at:     Mapped[datetime]       = mapped_column(TZ, server_default=func.now())


# ------------------------------------------------------------------------------
# DRIVER BEHAVIOR
# ------------------------------------------------------------------------------

class DriverBehaviorEvent(Base):
    __tablename__ = "driver_behavior_events"

    id:             Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    driver_id:      Mapped[str]            = mapped_column(String(36), ForeignKey("drivers.id"), index=True)
    trip_id:        Mapped[Optional[str]]  = mapped_column(String(36), ForeignKey("trips.id"), nullable=True, index=True)
    event_type:     Mapped[str]            = mapped_column(String(50), index=True)
    severity:       Mapped[str]            = mapped_column(String(20), default="medium", index=True)
    measured_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    threshold:      Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes:          Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    occurred_at:    Mapped[datetime]       = mapped_column(TZ, index=True)
    created_at:     Mapped[datetime]       = mapped_column(TZ, server_default=func.now())


class DriverScorecard(Base):
    __tablename__ = "driver_scorecards"

    id:                 Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    driver_id:          Mapped[str]            = mapped_column(String(36), ForeignKey("drivers.id"), index=True)
    score_period_start: Mapped[datetime]       = mapped_column(TZ, index=True)
    score_period_end:   Mapped[datetime]       = mapped_column(TZ, index=True)
    safety_score:       Mapped[float]          = mapped_column(Float, default=0.0)
    efficiency_score:   Mapped[float]          = mapped_column(Float, default=0.0)
    punctuality_score:  Mapped[float]          = mapped_column(Float, default=0.0)
    total_score:        Mapped[float]          = mapped_column(Float, default=0.0)
    summary:            Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    generated_at:       Mapped[datetime]       = mapped_column(TZ, index=True)
    created_at:         Mapped[datetime]       = mapped_column(TZ, server_default=func.now())


class CoachingRecommendation(Base):
    __tablename__ = "coaching_recommendations"

    id:                  Mapped[str]             = mapped_column(String(36), primary_key=True, default=gen_uuid)
    driver_id:           Mapped[str]             = mapped_column(String(36), ForeignKey("drivers.id"), index=True)
    recommendation_type: Mapped[str]             = mapped_column(String(80), index=True)
    reason:              Mapped[str]             = mapped_column(Text)
    suggested_action:    Mapped[str]             = mapped_column(Text)
    generated_at:        Mapped[datetime]        = mapped_column(TZ, index=True)
    acknowledged_at:     Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    created_at:          Mapped[datetime]        = mapped_column(TZ, server_default=func.now())


# ------------------------------------------------------------------------------
# OCR / DOCUMENT EXTRACTION
# ------------------------------------------------------------------------------

class DocumentOCRJob(Base):
    __tablename__ = "document_ocr_jobs"

    id:            Mapped[str]             = mapped_column(String(36), primary_key=True, default=gen_uuid)
    document_type: Mapped[str]             = mapped_column(String(50), index=True)
    entity_type:   Mapped[str]             = mapped_column(String(50), index=True)
    entity_id:     Mapped[str]             = mapped_column(String(36), index=True)
    file_url:      Mapped[str]             = mapped_column(String(500))
    status:        Mapped[str]             = mapped_column(String(20), default="uploaded", index=True)
    processor:     Mapped[Optional[str]]   = mapped_column(String(80), nullable=True)
    extracted_text: Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    started_at:    Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    completed_at:  Mapped[Optional[datetime]] = mapped_column(TZ, nullable=True)
    error_message: Mapped[Optional[str]]   = mapped_column(Text, nullable=True)
    created_at:    Mapped[datetime]        = mapped_column(TZ, server_default=func.now())


class ExtractedDocumentField(Base):
    __tablename__ = "extracted_document_fields"

    id:          Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    ocr_job_id:  Mapped[str]            = mapped_column(String(36), ForeignKey("document_ocr_jobs.id"), index=True)
    field_name:  Mapped[str]            = mapped_column(String(120), index=True)
    field_value: Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    confidence:  Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at:  Mapped[datetime]       = mapped_column(TZ, server_default=func.now())


class DocumentVerificationIssue(Base):
    __tablename__ = "document_verification_issues"

    id:         Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    ocr_job_id: Mapped[str]            = mapped_column(String(36), ForeignKey("document_ocr_jobs.id"), index=True)
    issue_type: Mapped[str]            = mapped_column(String(80), index=True)
    severity:   Mapped[str]            = mapped_column(String(20), default="medium", index=True)
    message:    Mapped[str]            = mapped_column(Text)
    created_at: Mapped[datetime]       = mapped_column(TZ, server_default=func.now())


# ------------------------------------------------------------------------------
# ASSISTANT
# ------------------------------------------------------------------------------

class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id:           Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    title:        Mapped[str]            = mapped_column(String(255))
    source_type:  Mapped[str]            = mapped_column(String(50), index=True)
    source_ref:   Mapped[Optional[str]]  = mapped_column(String(255), nullable=True)
    entity_type:  Mapped[Optional[str]]  = mapped_column(String(50), nullable=True, index=True)
    entity_id:    Mapped[Optional[str]]  = mapped_column(String(36), nullable=True, index=True)
    content_text: Mapped[str]            = mapped_column(Text)
    created_at:   Mapped[datetime]       = mapped_column(TZ, server_default=func.now())
    updated_at:   Mapped[datetime]       = mapped_column(TZ, server_default=func.now(), onupdate=func.now())


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id:            Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    document_id:   Mapped[str]            = mapped_column(String(36), ForeignKey("knowledge_documents.id"), index=True)
    chunk_text:    Mapped[str]            = mapped_column(Text)
    chunk_order:   Mapped[int]            = mapped_column(Integer, default=0)
    embedding_ref: Mapped[Optional[str]]  = mapped_column(String(255), nullable=True)
    created_at:    Mapped[datetime]       = mapped_column(TZ, server_default=func.now())


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id:         Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id:    Mapped[str]            = mapped_column(String(36), ForeignKey("users.id"), index=True)
    title:      Mapped[Optional[str]]  = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime]       = mapped_column(TZ, server_default=func.now())
    updated_at: Mapped[datetime]       = mapped_column(TZ, server_default=func.now(), onupdate=func.now())


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id:          Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    session_id:  Mapped[str]            = mapped_column(String(36), ForeignKey("chat_sessions.id"), index=True)
    role:        Mapped[str]            = mapped_column(String(20), index=True)
    content:     Mapped[str]            = mapped_column(Text)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at:  Mapped[datetime]       = mapped_column(TZ, server_default=func.now())


class AssistantActionLog(Base):
    __tablename__ = "assistant_action_logs"

    id:          Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    session_id:  Mapped[Optional[str]]  = mapped_column(String(36), ForeignKey("chat_sessions.id"), nullable=True, index=True)
    user_id:     Mapped[Optional[str]]  = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    tool_name:   Mapped[str]            = mapped_column(String(80), index=True)
    target_type: Mapped[Optional[str]]  = mapped_column(String(50), nullable=True)
    target_id:   Mapped[Optional[str]]  = mapped_column(String(36), nullable=True)
    result_text: Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    created_at:  Mapped[datetime]       = mapped_column(TZ, server_default=func.now())


# ------------------------------------------------------------------------------
# DASHBOARDS & REPORTS
# ------------------------------------------------------------------------------

class DashboardTemplate(Base):
    __tablename__ = "dashboard_templates"

    id:          Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name:        Mapped[str]            = mapped_column(String(120), unique=True, index=True)
    description: Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    config_json: Mapped[dict]           = mapped_column(JSON, default=dict)
    created_by:  Mapped[Optional[str]]  = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at:  Mapped[datetime]       = mapped_column(TZ, server_default=func.now())
    widgets_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class UserDashboardPreference(Base):
    __tablename__ = "user_dashboard_preferences"

    id:                  Mapped[str]             = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id:             Mapped[str]             = mapped_column(String(36), ForeignKey("users.id"), unique=True, index=True)
    dashboard_template_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("dashboard_templates.id"), nullable=True)
    widgets_json:        Mapped[dict]            = mapped_column(JSON, default=dict)
    layout_json:         Mapped[dict]            = mapped_column(JSON, default=dict)
    updated_at:          Mapped[datetime]        = mapped_column(TZ, server_default=func.now(), onupdate=func.now())


class SavedReport(Base):
    __tablename__ = "saved_reports"

    id:          Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id:     Mapped[str]            = mapped_column(String(36), ForeignKey("users.id"), index=True)
    name:        Mapped[str]            = mapped_column(String(120))
    report_type: Mapped[str]            = mapped_column(String(50), index=True)
    filters_json: Mapped[dict]          = mapped_column(JSON, default=dict)
    config_json: Mapped[dict]           = mapped_column(JSON, default=dict)
    created_at:  Mapped[datetime]       = mapped_column(TZ, server_default=func.now())
    updated_at:  Mapped[datetime]       = mapped_column(TZ, server_default=func.now(), onupdate=func.now())


class ReportWidgetConfig(Base):
    __tablename__ = "report_widget_configs"

    id:          Mapped[str]            = mapped_column(String(36), primary_key=True, default=gen_uuid)
    code:        Mapped[str]            = mapped_column(String(80), unique=True, index=True)
    name:        Mapped[str]            = mapped_column(String(120))
    category:    Mapped[str]            = mapped_column(String(50), index=True)
    config_json: Mapped[dict]           = mapped_column(JSON, default=dict)
    created_at:  Mapped[datetime]       = mapped_column(TZ, server_default=func.now())
